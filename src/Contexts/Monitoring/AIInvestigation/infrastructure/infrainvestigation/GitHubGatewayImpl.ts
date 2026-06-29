import {
  GitCommit,
  GitCommitDiff,
  GitFileDiff,
} from "../../domain/InfraEvidence.js";
import { GitHubGateway } from "./GitHubGateway.js";

// GitHub REST API v3 でコミット履歴・差分を収集する（読み取り専用）。
// GITHUB_TOKEN / GITHUB_REPO（owner/repo 形式）が未設定の場合はスキップする。
export class GitHubGatewayImpl implements GitHubGateway {
  // 1コミット差分のトークン予算ガード。一覧 API は patch を返さないため詳細は per-commit fetch だが、
  // diff は容易に肥大するので「ファイル数」と「ファイルあたり patch 文字数」で頭打ちにする。
  private static readonly MAX_FILES = 30;
  private static readonly MAX_PATCH_CHARS = 4000;

  private readonly token: string;
  private readonly repo: string;
  private readonly ref: string;

  constructor(
    token: string = process.env.GITHUB_TOKEN ?? "",
    repo: string = process.env.GITHUB_REPO ?? "",
    // 調査対象の ref（ブランチ/タグ/sha）。空＝既定ブランチ。デモは demo/regression を固定する。
    ref: string = process.env.GITHUB_TARGET_REF ?? "",
  ) {
    this.token = token;
    this.repo = repo;
    this.ref = ref;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
    };
  }

  async listRecentCommits(params: {
    since: Date;
    limit?: number;
  }): Promise<GitCommit[]> {
    if (!this.token || !this.repo) return [];

    const limit = params.limit ?? 10;
    const query = new URLSearchParams({ per_page: String(limit) });
    if (this.ref) {
      // ref 固定（デモ運用）: その ref の tip コミットを「時刻フィルタなし」で返す。
      // 証跡コミットは静的に1回積むだけなので、審査員がいつ閲覧しても壁時計に依存せず
      // 直近コミットとして発見できる必要がある（since で絞ると静的コミットが窓外に落ちる）。
      query.set("sha", this.ref);
    } else {
      // 本番: 既定ブランチを障害発生時刻からの時間窓で絞る。
      query.set("since", params.since.toISOString());
    }
    const url = `https://api.github.com/repos/${this.repo}/commits?${query.toString()}`;

    const res = await fetch(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as Array<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
    }>;

    return data.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0],
      author: c.commit.author.name,
      committedAt: new Date(c.commit.author.date),
    }));
  }

  async getCommitDiff(params: { sha: string }): Promise<GitCommitDiff | null> {
    if (!this.token || !this.repo) return null;

    // 単一コミット詳細 API は一覧と違い files[].patch（unified diff）を含む。
    const url = `https://api.github.com/repos/${this.repo}/commits/${encodeURIComponent(params.sha)}`;

    const res = await fetch(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
      files?: Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch?: string;
      }>;
    };

    const all = data.files ?? [];
    const filesTruncated = all.length > GitHubGatewayImpl.MAX_FILES;
    const files: GitFileDiff[] = all
      .slice(0, GitHubGatewayImpl.MAX_FILES)
      .map((f) => {
        const over =
          f.patch !== undefined &&
          f.patch.length > GitHubGatewayImpl.MAX_PATCH_CHARS;
        return {
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          ...(f.patch !== undefined
            ? {
                patch: over
                  ? f.patch.slice(0, GitHubGatewayImpl.MAX_PATCH_CHARS)
                  : f.patch,
              }
            : {}),
          ...(over ? { truncated: true } : {}),
        };
      });

    return {
      sha: data.sha.slice(0, 7),
      // 詳細では本文も AI に有用なので first-line に縮めず全文を渡す（diff 本体に比べ十分小さい）。
      message: data.commit.message,
      author: data.commit.author.name,
      committedAt: new Date(data.commit.author.date),
      files,
      ...(filesTruncated ? { filesTruncated: true } : {}),
    };
  }
}

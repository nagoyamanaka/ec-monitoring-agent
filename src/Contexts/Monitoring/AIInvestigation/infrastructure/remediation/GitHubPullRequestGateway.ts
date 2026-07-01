import { RemediationPlan, RemediationResult } from "../../domain/remediation/RemediationPlan.js";
import { RemediationPort } from "../../domain/remediation/RemediationPort.js";

// commit の author/committer を AI 名義にする。in-process 起票でも「AI が作った修正」の
// 帰属を GitHub 上に残すため（起票トークンの持ち主＝人間とは区別する）。
const AI_COMMIT_IDENTITY = {
  name: "ai-remediation[bot]",
  email: "ai-remediation@users.noreply.github.com",
} as const;

// write 操作（PR起票）の唯一の出口。read-only の GitHubGateway とは意図的に分離する。
// GITHUB_TOKEN + GITHUB_REMEDIATION_REPO が未設定の場合は起票せず理由を返す。
// draft: true で作成し、自動マージは行わない。
export class GitHubPullRequestGateway implements RemediationPort {
  private readonly token: string;
  private readonly repo: string;
  // PR の base ブランチ。空なら既定ブランチ（本番=main）。デモは main を汚さないため
  // 事前に用意した baseline ブランチ（脆弱な状態）を指し、そこへ修正 PR を向ける。
  private readonly baseRef: string;

  constructor(
    token: string = process.env.GITHUB_TOKEN ?? "",
    repo: string = process.env.GITHUB_REMEDIATION_REPO ?? "",
    baseRef: string = process.env.GITHUB_REMEDIATION_BASE_REF ?? "",
  ) {
    this.token = token;
    this.repo = repo;
    this.baseRef = baseRef;
  }

  async draftPullRequest(plan: RemediationPlan): Promise<RemediationResult> {
    if (!this.token || !this.repo) {
      return {
        created: false,
        reason: "GITHUB_TOKEN or GITHUB_REMEDIATION_REPO is not configured",
      };
    }

    try {
      const baseBranch = this.baseRef || (await this.getDefaultBranch());
      const baseSha = await this.getBranchSha(baseBranch);
      await this.createBranch(plan.branch, baseSha);

      // 実依存の修正: base の package.json を読み、pnpm.overrides をマージして本物の diff にする。
      if (plan.packageOverrides && Object.keys(plan.packageOverrides).length > 0) {
        await this.applyPackageOverrides(plan.branch, plan.packageOverrides);
      }

      for (const change of plan.fileChanges) {
        await this.upsertFile(plan.branch, change.path, change.patch);
      }

      const prUrl = await this.createDraftPR({
        title: plan.title,
        body: plan.body,
        head: plan.branch,
        base: baseBranch,
      });

      return { created: true, pullRequestUrl: prUrl };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      return { created: false, reason };
    }
  }

  // 起票ブランチ上の package.json を取得し、pnpm.overrides に安全版をマージして書き戻す。
  // 既存フィールド（onlyBuiltDependencies 等）は保持し、対象パッケージの版だけを差し替える。
  private async applyPackageOverrides(
    branch: string,
    overrides: Readonly<Record<string, string>>,
  ): Promise<void> {
    const existing = await this.request(
      "GET",
      `/repos/${this.repo}/contents/package.json?ref=${encodeURIComponent(branch)}`,
    );
    const decoded = Buffer.from(
      (existing as { content: string }).content,
      "base64",
    ).toString("utf-8");
    const pkg = JSON.parse(decoded) as {
      pnpm?: { overrides?: Record<string, string> };
      [key: string]: unknown;
    };

    const pnpm = (pkg.pnpm ??= {});
    pnpm.overrides = { ...(pnpm.overrides ?? {}), ...overrides };

    // 末尾改行付き 2 スペース整形（一般的な package.json の体裁に合わせ diff を最小化）。
    const merged = `${JSON.stringify(pkg, null, 2)}\n`;
    await this.upsertFile(branch, "package.json", merged);
  }

  private async getDefaultBranch(): Promise<string> {
    const res = await this.request("GET", `/repos/${this.repo}`);
    return (res as { default_branch: string }).default_branch;
  }

  private async getBranchSha(branch: string): Promise<string> {
    const res = await this.request(
      "GET",
      `/repos/${this.repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    );
    return (res as { object: { sha: string } }).object.sha;
  }

  private async createBranch(branch: string, sha: string): Promise<void> {
    await this.request("POST", `/repos/${this.repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  private async upsertFile(
    branch: string,
    path: string,
    content: string,
  ): Promise<void> {
    // patch フィールドは新しいファイル全文として扱う
    const encoded = Buffer.from(content, "utf-8").toString("base64");

    let existingSha: string | undefined;
    try {
      const existing = await this.request(
        "GET",
        `/repos/${this.repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
      );
      existingSha = (existing as { sha: string }).sha;
    } catch {
      // ファイルが存在しない場合は新規作成
    }

    const body: Record<string, unknown> = {
      message: `fix: update ${path}`,
      content: encoded,
      branch,
      // commit を AI 名義にする（人間の起票トークンとは別に「AI が作った修正」を明示）。
      author: AI_COMMIT_IDENTITY,
      committer: AI_COMMIT_IDENTITY,
    };
    if (existingSha) body["sha"] = existingSha;

    await this.request("PUT", `/repos/${this.repo}/contents/${path}`, body);
  }

  private async createDraftPR(params: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<string> {
    const res = await this.request("POST", `/repos/${this.repo}/pulls`, {
      title: params.title,
      body: params.body,
      head: params.head,
      base: params.base,
      draft: true,
    });
    return (res as { html_url: string }).html_url;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }

    return res.json();
  }
}

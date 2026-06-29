import {
  CheckRunSummary,
  PullRequestDetails,
  PullRequestReadGateway,
} from "./PullRequestReadGateway.js";

/**
 * GitHub REST API v3 で修正PRを読み取り専用に引く PullRequestReadGateway 実装（タスク36）。
 * 修正PRは起票先（remediationRepo）に出るので、write 側 GitHubPullRequestGateway と同じ repo を見る。
 * GITHUB_TOKEN / repo 未設定時は null / 空配列を返してレビューを自然に省略させる（疎通主体の薄い infra・
 * 既存 GitHubGatewayImpl と同方針＝失敗で throw せず空を返す）。write メソッドは一切持たない。
 */
export class GitHubPullRequestReadGateway implements PullRequestReadGateway {
  private readonly token: string;
  private readonly repo: string;

  constructor(
    token: string = process.env.GITHUB_TOKEN ?? "",
    repo: string = process.env.GITHUB_REMEDIATION_REPO ?? process.env.GITHUB_TARGET_REPO ?? "",
  ) {
    this.token = token;
    this.repo = repo;
  }

  async getPullRequest(prNumber: number): Promise<PullRequestDetails | null> {
    if (!this.token || !this.repo) return null;

    const meta = (await this.request("GET", `/repos/${this.repo}/pulls/${prNumber}`)) as {
      html_url: string;
      title: string;
    } | null;
    if (!meta) return null;

    // diff は専用メディアタイプ、変更ファイルは files エンドポイントで取得する。
    const diff = (await this.requestRaw(
      "GET",
      `/repos/${this.repo}/pulls/${prNumber}`,
      "application/vnd.github.v3.diff",
    )) ?? "";

    const files = (await this.request(
      "GET",
      `/repos/${this.repo}/pulls/${prNumber}/files?per_page=100`,
    )) as Array<{ filename: string }> | null;

    return {
      number: prNumber,
      url: meta.html_url,
      title: meta.title,
      diff,
      changedFiles: (files ?? []).map((f) => f.filename),
    };
  }

  async getCheckRuns(prNumber: number): Promise<CheckRunSummary[]> {
    if (!this.token || !this.repo) return [];

    const pr = (await this.request("GET", `/repos/${this.repo}/pulls/${prNumber}`)) as {
      head: { sha: string };
    } | null;
    if (!pr) return [];

    const res = (await this.request(
      "GET",
      `/repos/${this.repo}/commits/${pr.head.sha}/check-runs`,
    )) as { check_runs?: Array<{ name: string; status: string; conclusion: string | null }> } | null;

    return (res?.check_runs ?? []).map((c) => ({
      name: c.name,
      status: c.status,
      conclusion: c.conclusion ?? "",
    }));
  }

  // JSON レスポンスを返す。失敗（404・権限・タイムアウト）は null（レビューを省略させる）。
  private async request(method: string, path: string): Promise<unknown | null> {
    try {
      const res = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // diff/patch のような生テキストを返す（専用メディアタイプ）。失敗は null。
  private async requestRaw(
    method: string,
    path: string,
    accept: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(`https://api.github.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: accept,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }
}

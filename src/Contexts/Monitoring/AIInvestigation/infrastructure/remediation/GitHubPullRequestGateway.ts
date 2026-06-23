import { RemediationPlan, RemediationResult } from "../../domain/remediation/RemediationPlan.js";
import { RemediationPort } from "../../domain/remediation/RemediationPort.js";

// write 操作（PR起票）の唯一の出口。read-only の GitHubGateway とは意図的に分離する。
// GITHUB_TOKEN + GITHUB_REMEDIATION_REPO が未設定の場合は起票せず理由を返す。
// draft: true で作成し、自動マージは行わない。
export class GitHubPullRequestGateway implements RemediationPort {
  private readonly token: string;
  private readonly repo: string;

  constructor(
    token: string = process.env.GITHUB_TOKEN ?? "",
    repo: string = process.env.GITHUB_REMEDIATION_REPO ?? "",
  ) {
    this.token = token;
    this.repo = repo;
  }

  async draftPullRequest(plan: RemediationPlan): Promise<RemediationResult> {
    if (!this.token || !this.repo) {
      return {
        created: false,
        reason: "GITHUB_TOKEN or GITHUB_REMEDIATION_REPO is not configured",
      };
    }

    try {
      const defaultBranch = await this.getDefaultBranch();
      const baseSha = await this.getBranchSha(defaultBranch);
      await this.createBranch(plan.branch, baseSha);

      for (const change of plan.fileChanges) {
        await this.upsertFile(plan.branch, change.path, change.patch);
      }

      const prUrl = await this.createDraftPR({
        title: plan.title,
        body: plan.body,
        head: plan.branch,
        base: defaultBranch,
      });

      return { created: true, pullRequestUrl: prUrl };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown error";
      return { created: false, reason };
    }
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

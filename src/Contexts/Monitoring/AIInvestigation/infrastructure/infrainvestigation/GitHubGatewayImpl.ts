import { GitCommit } from "../../domain/InfraEvidence.js";
import { GitHubGateway } from "./GitHubGateway.js";

// GitHub REST API v3 でコミット履歴を収集する（読み取り専用）。
// GITHUB_TOKEN / GITHUB_REPO（owner/repo 形式）が未設定の場合はスキップする。
export class GitHubGatewayImpl implements GitHubGateway {
  private readonly token: string;
  private readonly repo: string;

  constructor(
    token: string = process.env.GITHUB_TOKEN ?? "",
    repo: string = process.env.GITHUB_REPO ?? "",
  ) {
    this.token = token;
    this.repo = repo;
  }

  async listRecentCommits(params: {
    since: Date;
    limit?: number;
  }): Promise<GitCommit[]> {
    if (!this.token || !this.repo) return [];

    const limit = params.limit ?? 10;
    const url = `https://api.github.com/repos/${this.repo}/commits?since=${params.since.toISOString()}&per_page=${limit}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
      },
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
}

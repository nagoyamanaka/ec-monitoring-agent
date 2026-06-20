import { GitCommit } from "./InfraEvidence.js";

export interface GitHubGateway {
  // 指定日時以降の直近コミットを返す（読み取り専用）
  listRecentCommits(params: { since: Date; limit?: number }): Promise<GitCommit[]>;
}

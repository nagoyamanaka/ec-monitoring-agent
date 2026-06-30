import { GitCommit, GitCommitDiff } from "../../domain/InfraEvidence.js";

export interface GitHubGateway {
  // 指定日時以降の直近コミットを返す（読み取り専用）。障害前後の変更タイムラインを当たり付けする用途。
  listRecentCommits(params: { since: Date; limit?: number }): Promise<GitCommit[]>;
  // 指定 SHA のコミットのファイル単位コード差分を返す（読み取り専用）。
  // listRecentCommits で当たりを付けた1コミットを深掘りする詳細。未設定/権限なし/不明SHAは null。
  getCommitDiff(params: { sha: string }): Promise<GitCommitDiff | null>;
}

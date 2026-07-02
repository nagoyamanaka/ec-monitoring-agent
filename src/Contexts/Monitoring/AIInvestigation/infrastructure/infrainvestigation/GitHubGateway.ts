import { GitCommit, GitCommitDiff } from "../../domain/InfraEvidence.js";

// 未マージの open PR（＝まだ起きていない変更）。予兆（Forecast）の FUTURE_CHANGE シグナル源。
export type OpenPullRequest = {
  readonly number: number;
  readonly title: string;
  readonly author: string;
  readonly updatedAt: Date;
  readonly headRef: string; // ブランチ名（和文タイトル等で subject が潰れた場合の導出フォールバック）
  readonly draft: boolean;
  readonly url?: string; // PR の Web リンク（引用チップからの実在解決に使う）
};

export interface GitHubGateway {
  // 指定日時以降の直近コミットを返す（読み取り専用）。障害前後の変更タイムラインを当たり付けする用途。
  listRecentCommits(params: { since: Date; limit?: number }): Promise<GitCommit[]>;
  // 指定 SHA のコミットのファイル単位コード差分を返す（読み取り専用）。
  // listRecentCommits で当たりを付けた1コミットを深掘りする詳細。未設定/権限なし/不明SHAは null。
  getCommitDiff(params: { sha: string }): Promise<GitCommitDiff | null>;
  // 未マージの open PR を返す（読み取り専用）。listRecentCommits が「過去（起きた変更）」なのに対し
  // こちらは「未来（起きようとしている変更）」＝予兆の FUTURE_CHANGE シグナル源。
  listOpenPullRequests(params?: { limit?: number }): Promise<OpenPullRequest[]>;
}

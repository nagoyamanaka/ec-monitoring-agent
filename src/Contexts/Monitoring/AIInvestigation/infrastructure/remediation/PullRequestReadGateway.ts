/**
 * 修正PRを「読み取り専用」で引くゲートウェイ（タスク36・RV段階）。
 * RemediationReviewerAgent が diff / 変更ファイル / CI テスト結果を突き合わせて verdict を出すための
 * 入力源。write（PR起票・マージ）は持たせない＝write は GitHubPullRequestGateway（人間承認ゲートの内側）に
 * 閉じる原則を越境させない。read-only の GitHubGateway（コミット履歴）とは PR という別の関心事なので分離する。
 */

/** PR の概要＋diff＋変更ファイル一覧（読み取り専用）。 */
export type PullRequestDetails = {
  readonly number: number;
  readonly url: string;
  readonly title: string;
  // unified diff（patch）。レビューで根本原因との対応を見るのに使う。
  readonly diff: string;
  // 変更ファイルのパス一覧（証拠と整合するかの突き合わせに使う）。
  readonly changedFiles: string[];
};

/** PR に紐づく CI チェック結果（テストが障害経路をカバーするかの判定材料）。 */
export type CheckRunSummary = {
  readonly name: string;
  // queued / in_progress / completed 等。
  readonly status: string;
  // success / failure / neutral / null（未完了）等。
  readonly conclusion: string;
};

export interface PullRequestReadGateway {
  // 指定 PR の概要・diff・変更ファイルを読み取り専用で取得する（存在しない/未設定なら null）。
  getPullRequest(prNumber: number): Promise<PullRequestDetails | null>;
  // 指定 PR の CI チェック結果を読み取り専用で取得する（未設定・失敗なら空配列）。
  getCheckRuns(prNumber: number): Promise<CheckRunSummary[]>;
}

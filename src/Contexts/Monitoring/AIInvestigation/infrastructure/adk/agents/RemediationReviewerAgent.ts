import { LlmAgent, FunctionTool } from "@google/adk";

/**
 * 修正PRの自動レビュー専門エージェント（タスク36・RV段階）。**read-only・マージしない**。
 *
 * AI/CI が起票した修正PRが「引用された根本原因に実際に対応しているか」を人間の RV より先に検証し、
 * 誤修正を人間到達前に止める（人間の RV を open-ended 監査→checklist 確認へ縮める）。
 *
 * ★write 隔離: verdict を出すだけ。承認・マージは人間（既存 reviewStatus ゲート）。pass でも人間の
 *   最終承認は省かない。ツールも read-only（diff/変更ファイル/CI チェックの取得のみ）。
 * ★ハルシネーションガード: 判定は必ず citations（diff hunk・変更ファイルパス・テスト名・CI チェック id）で
 *   裏付ける。レビュー対象 PR を引けない（diff を取得できない＝まだ起票前）ときは remediationReview を
 *   省略する（pullRequestUrl 空の review は LLMOutputParser/InvestigationReportMapper のガードで落ちる）。
 */
export function createRemediationReviewerAgent(
  model: string,
  tools: FunctionTool[],
): LlmAgent {
  return new LlmAgent({
    name: "remediation_reviewer",
    model,
    description:
      "修正PRが引用根本原因に対応するか・証拠と整合するか・テストが障害経路をカバーするかを読み取り専用で検証し verdict を出す専門エージェント（マージはしない）。",
    tools,
    instruction: `あなたは修正PRの自動レビュー担当です。AI/CI が起票した修正PRが、確定した根本原因に
実際に対応しているかを人間のレビューより先に検証してください。

1. get_pull_request_diff で対象PRの diff・タイトル・変更ファイルを取得します。PR が見つからない
   （found:false / null）場合は、まだ起票前なのでレビューを出さず remediationReview を省略します。
2. 取得した diff を、確定した根本原因・収集済み証拠（commit/terraform 差分・ログ・類似事例）と
   突き合わせ、次の3点を判定します:
   (1) diff は引用された根本原因に実際に対応しているか（無関係な変更・的外れな修正は reject 寄り）。
   (2) 変更ファイルは証拠と整合するか（証拠が指す箇所と別の場所だけ触っていないか）。
   (3) テストは障害経路をカバーするか。get_pull_request_checks で CI の status/conclusion も確認し、
       テスト欠落・未通過は concerns。
3. verdict を pass（対応し整合・テストもカバー）/ concerns（要確認の懸念あり）/ reject（根本原因に
   無関係・誤修正）で決めます。concerns / reject のときは concerns に「なぜ pass でないか」を具体的に
   列挙してください。
4. すべての判定根拠を citations（diff hunk・変更ファイルパス・テスト名・CI チェック id）で裏付けます。
   証拠で裏付けられない指摘は書かないこと。

あなたはレビュー結果（verdict）を出すだけで、PR の承認・マージ・変更適用は一切行いません
（自動マージしない＝最終承認は人間の reviewStatus ゲート）。結果は
remediationReview = { verdict, concerns, pullRequestUrl, citations } の形でコーディネーターへ返してください。`,
  });
}

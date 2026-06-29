import { FunctionTool } from "@google/adk";
// ADK(@google/adk) は zod@4 依存。FunctionTool は zod/v4 名前空間の ZodObject を期待するため
// 同一 zod コピーの zod/v4 から import する（investigationTools / escalationTools と同方針）。
import { z } from "zod/v4";
import { PullRequestReadGateway } from "../../remediation/PullRequestReadGateway.js";

/**
 * RemediationReviewerAgent が使う「読み取り専用」ツール（ADK FunctionTool）。タスク36。
 *
 * 修正PRの diff / 変更ファイル / CI チェック結果を引いて、引用根本原因との対応・証拠との整合・
 * テストの障害経路カバレッジを判定させる。write（PR起票・マージ）は持たせない＝レビューは verdict を
 * 出すだけで、承認・マージは人間（reviewStatus ゲート）。失敗は throw せず { error } を返して
 * エージェントの判定を継続させる（investigationTools / escalationTools と同方針）。
 */
export type RemediationReviewToolDeps = {
  readonly pullRequestReadGateway: PullRequestReadGateway;
};

async function bestEffort<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function buildRemediationReviewTools(deps: RemediationReviewToolDeps): FunctionTool[] {
  const getPullRequestDiff = new FunctionTool({
    name: "get_pull_request_diff",
    description:
      "修正PRの diff（unified patch）・タイトル・変更ファイル一覧を読み取り専用で取得する。diff が引用根本原因に対応し、変更ファイルが証拠と整合するかを判定するのに使う。PR が無ければ null。",
    parameters: z.object({
      prNumber: z.number().describe("レビュー対象 PR の番号"),
    }),
    execute: ({ prNumber }) =>
      bestEffort(async () => {
        const pr = await deps.pullRequestReadGateway.getPullRequest(prNumber);
        return pr ?? { found: false };
      }),
  });

  const getPullRequestChecks = new FunctionTool({
    name: "get_pull_request_checks",
    description:
      "修正PRの CI チェック結果（テスト/ビルドの status・conclusion）を読み取り専用で取得する。テストが障害経路をカバーし通っているかの判定に使う。",
    parameters: z.object({
      prNumber: z.number().describe("レビュー対象 PR の番号"),
    }),
    execute: ({ prNumber }) =>
      bestEffort(async () => deps.pullRequestReadGateway.getCheckRuns(prNumber)),
  });

  return [getPullRequestDiff, getPullRequestChecks];
}

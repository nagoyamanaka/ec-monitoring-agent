import type { InvestigationMetricsPrimitives } from "../../AlertAnalysis/domain/contracts/AlertContract.js";
import { InvestigationContext } from "./InvestigationContext.js";

/**
 * 調査の「働きの明細」（タスク G1）＝実測メトリクスの組み立て。
 *
 * 表示するのはシステムが実際に記録した事実のみ（経過時間・読んだ証拠の件数）で、
 * 「人間なら◯分」等の根拠を出せない換算はここでも UI でも行わない（盛らない制約）。
 * 件数は AI 調査に渡した InvestigationContext から deterministic に導出する＝
 * ADK / 単一 Gemini のどちらの経路でも同じ入力から同じ形になる（LLM 出力に依存しない）。
 */
export function buildInvestigationMetrics(
  context: InvestigationContext,
  elapsedMs: number,
): InvestigationMetricsPrimitives {
  const evidence = context.infraEvidence;
  return {
    elapsedMs,
    evidenceCounts: {
      logs: evidence?.appLogs.length ?? 0,
      metrics: evidence?.metrics?.length ?? 0,
      terraformChanges: evidence?.terraformDiff?.resourceChanges.length ?? 0,
      commits: evidence?.recentCommits?.length ?? 0,
      similarIncidents: context.similarIncidents.length,
    },
  };
}

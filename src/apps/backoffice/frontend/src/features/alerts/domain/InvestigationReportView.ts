import type { InvestigationReportPrimitives } from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import type { AlertSeverity } from "./AlertView";

/**
 * 調査レポートの表示用型と、ワイヤ契約（共有 contracts の InvestigationReportPrimitives）→ View の純関数。
 * domain は型＋純関数のみ。ワイヤ形式は backend と共有する単一ソース（型のみ・ランタイム非依存）を import する。
 */

export type ReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

/** 表示用に型を絞った調査レポート。AlertCardExpanded / AlertDetailPage が消費する。 */
export type InvestigationReportView = {
  readonly summary: string;
  readonly confidence: number;
  readonly severity: AlertSeverity;
  readonly investigationSteps: string[];
  readonly suggestedActions: string[];
  readonly suggestedPatternName: string;
  readonly reviewStatus: ReviewStatus;
  readonly investigatedAt: string;
  readonly isFallback: boolean;
  // AI が「コードで直せる」と判定したか。remediate ボタンの活性／ROI 提示に使う（未指定は false）。
  readonly remediable: boolean;
};

export function toInvestigationReportView(
  dto: InvestigationReportPrimitives,
): InvestigationReportView {
  return {
    summary: dto.summary,
    confidence: dto.confidence,
    severity: dto.severity as AlertSeverity,
    investigationSteps: dto.investigationSteps,
    suggestedActions: dto.suggestedActions,
    suggestedPatternName: dto.suggestedPatternName,
    reviewStatus: dto.reviewStatus as ReviewStatus,
    investigatedAt: dto.investigatedAt,
    isFallback: dto.isFallback,
    remediable: dto.remediable ?? false,
  };
}

/** レビュー済み（承認/却下）か。承認/却下ボタンの表示制御に使う純関数。 */
export function isReviewed(reviewStatus: ReviewStatus): boolean {
  return reviewStatus !== "PENDING_REVIEW";
}

import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity, AlertSeverities } from "../../../Shared/domain/AlertSeverity.js";
import { LLMInvestigationOutput } from "./LLMOutputParser.js";

/**
 * 検証済みLLM出力 → ドメイン型 InvestigationReport への変換、および失敗時の fallback 生成。
 * confidence は [0,1] にクランプ、未知 severity は WARNING に丸める。
 * reviewStatus / investigatedAt / isFallback はLLM出力ではなくここで付与する。
 */

function clampConfidence(value: number): number {
  return Math.max(0.0, Math.min(1.0, value));
}

function parseSeverity(value: string): AlertSeverity {
  const upper = value.toUpperCase();
  if (
    upper === AlertSeverities.CRITICAL ||
    upper === AlertSeverities.WARNING ||
    upper === AlertSeverities.INFO
  ) {
    return AlertSeverity.fromString(upper);
  }
  return AlertSeverity.warning();
}

export function toInvestigationReport(output: LLMInvestigationOutput): InvestigationReport {
  return new InvestigationReport({
    summary: output.summary,
    confidence: clampConfidence(output.confidence),
    severity: parseSeverity(output.severity),
    investigationSteps: output.investigationSteps,
    suggestedActions: output.suggestedActions,
    suggestedPatternName: output.suggestedPatternName,
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date(),
    isFallback: false,
  });
}

export function buildFallbackReport(): InvestigationReport {
  return new InvestigationReport({
    summary: "自動調査に失敗しました。手動での確認が必要です。",
    confidence: 0,
    severity: AlertSeverity.warning(),
    investigationSteps: [],
    suggestedActions: ["手動での障害調査を実施してください"],
    suggestedPatternName: "",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date(),
    isFallback: true,
  });
}

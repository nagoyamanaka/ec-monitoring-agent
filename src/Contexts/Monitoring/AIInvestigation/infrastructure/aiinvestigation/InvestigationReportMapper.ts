import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity, AlertSeverities } from "../../../Shared/domain/AlertSeverity.js";
import type {
  InvestigationStepPrimitives,
  ImpactAssessmentPrimitives,
  EscalationDraftPrimitives,
  RemediationReviewPrimitives,
} from "../../../AlertAnalysis/domain/contracts/AlertContract.js";
import { LLMInvestigationOutput } from "./LLMOutputParser.js";

/**
 * 検証済みLLM出力 → ドメイン型 InvestigationReport への変換、および失敗時の fallback 生成。
 * confidence は [0,1] にクランプ、未知 severity は WARNING に丸める。
 * reviewStatus / investigatedAt / isFallback はLLM出力ではなくここで付与する。
 */

function clampConfidence(value: number): number {
  return Math.max(0.0, Math.min(1.0, value));
}

/**
 * 影響評価のハルシネーションガード。証拠 id（citations）の無い impact は「根拠なき影響主張」
 * なので表示・永続化前に落とす（undefined＝影響評価なし）。§7.3 の citation 必須方針と同じ。
 */
function guardImpact(
  impact: ImpactAssessmentPrimitives | undefined,
): ImpactAssessmentPrimitives | undefined {
  if (!impact || impact.citations.length === 0) return undefined;
  return impact;
}

/**
 * エスカレーション草案のハルシネーションガード。`team` の無い草案は「宛先を引けなかった＝捏造」なので
 * 表示・永続化前に落とす（undefined＝草案なし）。宛先は体制マスタ（EscalationDirectory）由来に限る
 * という方針で、impact の citations 必須ガードと同じ（根拠なき宛先を出さない）。
 */
function guardEscalation(
  escalation: EscalationDraftPrimitives | undefined,
): EscalationDraftPrimitives | undefined {
  if (!escalation || escalation.team.trim() === "") return undefined;
  return escalation;
}

/**
 * 修正PR自動レビューのハルシネーションガード。`pullRequestUrl` の無いレビューは「レビュー対象 PR を
 * 引けなかった＝何をレビューしたか不明」なので表示・永続化前に落とす（undefined＝レビューなし）。
 * 初期調査時点（PR 未起票）はここで自然に落ちる。impact の citations・escalation の team と同方針。
 */
function guardRemediationReview(
  review: RemediationReviewPrimitives | undefined,
): RemediationReviewPrimitives | undefined {
  if (!review || review.pullRequestUrl.trim() === "") return undefined;
  return review;
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

export function toInvestigationReport(
  output: LLMInvestigationOutput,
  // evidence から決定的に導出した外部リンク（LLM はテキストのみ・URL は作らせない）。
  // 「証拠を見るべき場所」として調査ステップ末尾へ追記する。
  evidenceLinks: InvestigationStepPrimitives[] = [],
): InvestigationReport {
  return new InvestigationReport({
    summary: output.summary,
    confidence: clampConfidence(output.confidence),
    severity: parseSeverity(output.severity),
    investigationSteps: [...output.investigationSteps, ...evidenceLinks],
    suggestedActions: output.suggestedActions,
    suggestedPatternName: output.suggestedPatternName,
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date(),
    isFallback: false,
    remediable: output.remediable,
    relatedAlerts: output.relatedAlerts,
    impact: guardImpact(output.impact),
    escalation: guardEscalation(output.escalation),
    remediationReview: guardRemediationReview(output.remediationReview),
  });
}

export function buildFallbackReport(
  // AI 出力が使えなくても、収集済み evidence から決定的に導出したリンク（コミット・ログ）は
  // 「どこを見ればよいか」の一次情報として価値がある。パース不能で fallback に落ちても、
  // 収集できていた証拠リンクだけは調査ステップとして残す（空なら従来どおり空表示）。
  evidenceLinks: InvestigationStepPrimitives[] = [],
): InvestigationReport {
  return new InvestigationReport({
    summary: "自動調査に失敗しました。手動での確認が必要です。",
    confidence: 0,
    severity: AlertSeverity.warning(),
    investigationSteps: [...evidenceLinks],
    suggestedActions: ["手動での障害調査を実施してください"],
    suggestedPatternName: "",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date(),
    isFallback: true,
  });
}

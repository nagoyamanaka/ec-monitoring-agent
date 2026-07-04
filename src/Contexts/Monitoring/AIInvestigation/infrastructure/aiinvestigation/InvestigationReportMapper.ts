import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity, AlertSeverities } from "../../../Shared/domain/AlertSeverity.js";
import type {
  InvestigationStepPrimitives,
  ImpactAssessmentPrimitives,
  EscalationDraftPrimitives,
  RemediationReviewPrimitives,
  RelatedAlertPrimitives,
} from "../../../AlertAnalysis/domain/contracts/AlertContract.js";
import { collectCitedEvidenceText } from "../../domain/CitedEvidence.js";
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
 * 相関（relatedAlerts）のハルシネーションガード（タスク J1）。2段で落とす:
 * (1) 収集済み証拠 id（collectCitableEvidenceIds の語彙）に解決しない citation を除去し、
 * (2) 解決済み citation がゼロになった関連を丸ごと破棄する。
 * 「指せる共有証拠が無い関連は関連にしない」＝時間的に近いだけの捏造因果（決済↔在庫）は
 * 構造的に落ち、terraform/commit を共有する正当な相関（インフラ→アプリ）は残る。
 * 解決判定は「citation 文字列が証拠 id を含む」（cited_commit と同じ流儀・case-insensitive）。
 * Forecast の引用検証（偽引用ドロップ→裏付けゼロのリスク破棄）と同型の2段。
 */
function guardRelatedAlerts(
  relatedAlerts: RelatedAlertPrimitives[],
  citableEvidenceIds: readonly string[],
): RelatedAlertPrimitives[] {
  return relatedAlerts.flatMap((related) => {
    const citations = (related.citations ?? []).filter((citation) => {
      const lower = citation.toLowerCase();
      return citableEvidenceIds.some((id) => lower.includes(id));
    });
    if (citations.length === 0) return [];
    return [{ ...related, citations }];
  });
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

/** GitHub コミットページの href から sha を取り出すパターン（buildEvidenceLinks の逆写像）。 */
const COMMIT_LINK_PATTERN = /\/commit\/([0-9a-f]+)\/?$/i;

/**
 * evidenceLinks のうちコミットリンクを、AI が報告書で実際に引用した sha だけに絞る。
 *
 * 背景: 証拠収集は「直近 N 件のコミット」を無条件に積むため、全件連結すると原因と無関係な
 * merge/別件コミットが調査ステップに並ぶ。証拠パネル側は CitedCommitFilter で引用絞り済みの
 * ため「ステップには10コミット・証拠は0件」という矛盾に見えていた。ここで同じ引用判定
 * （CitedEvidence）を適用し両者の見え方を一致させる。コミット以外のリンク（Cloud Logging 等）
 * は決定的導出のまま残す。fallback（buildFallbackReport）は絞らず全件温存＝「失敗しても
 * 収集済みの一次情報は空にしない」の方針はそのまま。
 */
function restrictCommitLinksToCited(
  links: InvestigationStepPrimitives[],
  citedText: string,
): InvestigationStepPrimitives[] {
  const cited = citedText.toLowerCase();
  return links.filter((link) => {
    const sha = link.href?.match(COMMIT_LINK_PATTERN)?.[1];
    if (!sha) return true;
    return cited.includes(sha.toLowerCase());
  });
}

export function toInvestigationReport(
  output: LLMInvestigationOutput,
  // evidence から決定的に導出した外部リンク（LLM はテキストのみ・URL は作らせない）。
  // 「証拠を見るべき場所」として、AI が引用したコミットに絞ったうえで調査ステップ末尾へ追記する。
  evidenceLinks: InvestigationStepPrimitives[] = [],
  // 相関ガードの照合語彙（collectCitableEvidenceIds で context から決定的に導出・小文字化済み）。
  // 既定は空＝citation が解決できず relatedAlerts は全て落ちる（安全側。アダプタは必ず渡す）。
  citableEvidenceIds: readonly string[] = [],
): InvestigationReport {
  // ハルシネーションガード適用後の値を引用源にする（証拠パネルの CitedCommitFilter は
  // 永続化後＝ガード済みの報告書を読むため、同じ土台で判定しないと両者がずれる）。
  const impact = guardImpact(output.impact);
  const escalation = guardEscalation(output.escalation);
  const remediationReview = guardRemediationReview(output.remediationReview);
  const citedLinks = restrictCommitLinksToCited(
    evidenceLinks,
    collectCitedEvidenceText({
      summary: output.summary,
      impact,
      escalation,
      remediationReview,
    }),
  );
  return new InvestigationReport({
    summary: output.summary,
    confidence: clampConfidence(output.confidence),
    severity: parseSeverity(output.severity),
    investigationSteps: [...output.investigationSteps, ...citedLinks],
    suggestedActions: output.suggestedActions,
    suggestedPatternName: output.suggestedPatternName,
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date(),
    isFallback: false,
    remediable: output.remediable,
    relatedAlerts: guardRelatedAlerts(output.relatedAlerts, citableEvidenceIds),
    impact,
    escalation,
    remediationReview,
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

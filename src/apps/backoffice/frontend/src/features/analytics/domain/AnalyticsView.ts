/**
 * Analytics（AI 分類の精度トラッキング）の表示型と写像。
 * backend `GET /analytics`（AnalyticsResponse）の素の集計値を、画面で割合表示しやすい
 * 派生値（％・比率）付きの View に正規化する純関数。ワイヤ契約は analytics 専用 BC が
 * contracts に持たないため、ここで DTO を定義する（将来 contracts へ昇格可）。
 */

/** 承認済み（過去にクローズした）アラートの一行サマリ（backend ApprovedAlertSummary と同形）。 */
export type ApprovedAlertSummaryDto = {
  readonly id: string;
  readonly eventName: string;
  readonly category: string;
  readonly severity: string;
  readonly classificationType: "known" | "unknown";
  readonly patternName: string | null;
  readonly occurredOn: string;
  readonly occurrenceCount: number;
  readonly operatorNote: string | null;
};

/** GET /analytics の生レスポンス（backend AnalyticsResponse と同形）。 */
export type AnalyticsDto = {
  readonly totalAlerts: number;
  readonly knownCount: number;
  readonly unknownCount: number;
  readonly withFeedbackCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  /** フィードバック母数0のときは null（0除算回避）。 */
  readonly accuracy: number | null;
  /** 承認済みアラート（過去の判断）。新しい順。旧backend互換で未定義を許容。 */
  readonly approvedAlerts?: readonly ApprovedAlertSummaryDto[];
  /** 昇格（結晶化）済みパターン数。学習ループの成果指標。旧backend互換で未定義を許容。 */
  readonly promotedPatternCount?: number;
};

export type AnalyticsView = {
  readonly totalAlerts: number;
  readonly knownCount: number;
  readonly unknownCount: number;
  readonly withFeedbackCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  /** 0..1 の正答率。フィードバック未着なら null。 */
  readonly accuracy: number | null;
  /** 正答率の整数％（null は null）。ゲージ/数値表示用。 */
  readonly accuracyPercent: number | null;
  /** 既知分類の割合（0..1）。総数0なら0。 */
  readonly knownRatio: number;
  /** 承認済みアラート（過去の判断）。新しい順。 */
  readonly approvedAlerts: readonly ApprovedAlertSummaryDto[];
  /** 昇格（結晶化）済みパターン数。 */
  readonly promotedPatternCount: number;
};

export function toAnalyticsView(dto: AnalyticsDto): AnalyticsView {
  const accuracyPercent =
    dto.accuracy === null ? null : Math.round(dto.accuracy * 100);
  const knownRatio =
    dto.totalAlerts === 0 ? 0 : dto.knownCount / dto.totalAlerts;
  return {
    totalAlerts: dto.totalAlerts,
    knownCount: dto.knownCount,
    unknownCount: dto.unknownCount,
    withFeedbackCount: dto.withFeedbackCount,
    correctCount: dto.correctCount,
    incorrectCount: dto.incorrectCount,
    accuracy: dto.accuracy,
    accuracyPercent,
    knownRatio,
    approvedAlerts: dto.approvedAlerts ?? [],
    promotedPatternCount: dto.promotedPatternCount ?? 0,
  };
}

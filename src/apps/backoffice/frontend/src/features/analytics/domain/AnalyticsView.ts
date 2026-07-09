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

/**
 * 「学習の軌跡」ヒーローの代表1件を選ぶ純関数（U5）。
 * ライフサイクル物語（未知→AI調査→承認→既知昇格→再一致）の主人公は、
 * **未知として調査され AI 推定パターン名を持ち、人間が承認した**アラート。
 * approvedAlerts は承認（＝正解フィードバック）済みのみなので「承認」は満たされている前提。
 *
 * 優先順位（memory: 実装前に seed で代表存在確認）:
 *   1. 再発済み（occurrenceCount>1）＝「昇格後に再一致した」痕跡が最も物語に合う。
 *   2. 無ければ AI 推定 patternName を持つ unknown（seed 直後はこちら＝再発はまだ無い）。
 * どちらも無ければ null（ヒーローは empty state に劣化）。
 * 入力は新しい順で来る前提なので、条件一致のうち先頭＝最新を返す。
 */
export function selectLifecycleAlert(
  approvedAlerts: readonly ApprovedAlertSummaryDto[],
): ApprovedAlertSummaryDto | null {
  const candidates = approvedAlerts.filter(
    (a) => a.classificationType === "unknown" && !!a.patternName?.trim(),
  );
  if (candidates.length === 0) return null;
  return candidates.find((a) => a.occurrenceCount > 1) ?? candidates[0];
}

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

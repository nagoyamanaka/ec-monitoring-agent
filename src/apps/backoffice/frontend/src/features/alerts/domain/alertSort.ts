import type { AlertView } from "./AlertView";
import { severityWeight } from "./severity";
import { isReviewed } from "./InvestigationReportView";

/** レビュー済み（承認/却下）は 1=下、未処理は 0=上。 */
function reviewedRank(alert: AlertView): number {
  return alert.report && isReviewed(alert.report.reviewStatus) ? 1 : 0;
}

/**
 * トリアージ用比較関数（純）。「上から潰せばよい」並びにする:
 *   ① 未処理を上 / 処理済み（承認・却下）を下
 *   ② 重大度の降順（CRITICAL→WARNING→INFO）
 *   ③ 発生時刻の降順（新しいほど上）
 * 安定ソート前提で、同点は元の順序（useAlerts のマージ順）を保つ。
 */
export function compareForTriage(a: AlertView, b: AlertView): number {
  const byReviewed = reviewedRank(a) - reviewedRank(b);
  if (byReviewed !== 0) return byReviewed;

  const bySeverity = severityWeight(b.severity) - severityWeight(a.severity);
  if (bySeverity !== 0) return bySeverity;

  return new Date(b.occurredOn).getTime() - new Date(a.occurredOn).getTime();
}

/** 一覧をトリアージ順に並べた新配列を返す（元配列は破壊しない）。 */
export function sortForTriage(alerts: readonly AlertView[]): AlertView[] {
  return alerts.slice().sort(compareForTriage);
}

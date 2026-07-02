import type { AlertView } from "./AlertView";

/** 承認済み（対処済み）は 1=下、未処理/却下は 0=上。 */
function approvedRank(alert: AlertView): number {
  return alert.feedback?.isCorrect === true ? 1 : 0;
}

/**
 * 一覧の既定比較関数（純）。最新時刻順を基本に、承認済み（対処済み）だけ最下部へ沈める:
 *   ① 未処理/却下を上 / 承認済みを下
 *   ② 発生時刻の降順（新しいほど上）
 * 安定ソート前提で、同点は元の順序（useAlerts のマージ順）を保つ。
 * 将来モードを増やすときは、この比較関数を差し替え可能にする（現状は最新時刻順のみ）。
 */
export function compareByRecency(a: AlertView, b: AlertView): number {
  const byApproved = approvedRank(a) - approvedRank(b);
  if (byApproved !== 0) return byApproved;

  return new Date(b.occurredOn).getTime() - new Date(a.occurredOn).getTime();
}

/** 一覧を既定順（最新時刻順・承認済みは最下部）に並べた新配列を返す（元配列は破壊しない）。 */
export function sortAlerts(alerts: readonly AlertView[]): AlertView[] {
  return alerts.slice().sort(compareByRecency);
}

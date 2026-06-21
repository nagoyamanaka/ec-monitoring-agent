import type { AlertView } from "./AlertView";

/**
 * ストリーム受信した 1 件の AlertView を一覧へマージする純関数（型のみ依存・React 非依存）。
 * - 同一 id が既にあれば「その位置のまま」差し替える（ANALYZING→OPEN 遷移でカードが飛ばない）
 * - 未知の id は先頭へ積む（最新が上）
 * 既存配列は破壊せず新しい配列を返す（React の setState と整合）。
 */
export function mergeAlert(
  alerts: readonly AlertView[],
  incoming: AlertView,
): AlertView[] {
  const index = alerts.findIndex((a) => a.id === incoming.id);
  if (index === -1) {
    return [incoming, ...alerts];
  }
  const next = alerts.slice();
  next[index] = incoming;
  return next;
}

/**
 * 取得済み一覧（base）へ、ストリームで先着していた alerts を畳み込んでマージする純関数。
 * 初回 fetch 完了時、fetch 解決前に届いていた stream 分を取りこぼさないために使う。
 * base をサーバ順の土台とし、stream 分は mergeAlert の規則（同 id 置換／新規は先頭）で載せる。
 */
export function mergeAlerts(
  base: readonly AlertView[],
  streamed: readonly AlertView[],
): AlertView[] {
  return streamed.reduce<AlertView[]>(
    (acc, alert) => mergeAlert(acc, alert),
    base.slice(),
  );
}

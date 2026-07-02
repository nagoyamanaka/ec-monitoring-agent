/**
 * 日時表示の ja-JP 統一フォーマッタ。
 * 実行環境のロケール任せ（`toLocaleString()` 引数なし）だと英語環境で
 * `7/2/2026, 2:16:55 PM` の英語式になるため、明示的に ja-JP を指定する。
 * ISO 文字列（wire 形式）と Date の両方を受け、パース不能はそのまま返す（表示の穴を防ぐ）。
 */

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** 例: `2026/7/2 14:16:55`。カード tooltip・ドロワー・詳細ページの絶対時刻に使う。 */
export function formatDateTimeJa(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ja-JP");
}

/** 例: `14:16:55`。同日内の時刻レンジ（重複観測の初回→最新など）に使う。 */
export function formatTimeJa(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString("ja-JP");
}

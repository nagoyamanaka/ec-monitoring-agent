// 異種ソース（未マージPR / 未適用plan / スケジュール / 過去インシデント）を
// 共通の突合軸 subject + when + desc に正規化する器。LLM 突合の入力単位であり、
// RiskItem.citations から id で参照される（引用検証はこの id への実在照合）。
export const ForecastSignalKind = {
  FUTURE_CHANGE: "FUTURE_CHANGE", // 未マージPR / 未適用plan
  SCHEDULE: "SCHEDULE", // 業務/負荷スケジュール
  MEMORY: "MEMORY", // 過去インシデント（ForecastMemory 由来）
} as const;

export type ForecastSignalKind =
  (typeof ForecastSignalKind)[keyof typeof ForecastSignalKind];

export type ForecastSignal = {
  readonly id: string; // "chg-1" / "sch-1" / "inc-7"（citations で参照される）
  readonly kind: ForecastSignalKind;
  readonly subject: string; // 突合キー（例: "db.connection_pool" / "checkout"）
  readonly when: string; // 時間窓（例: "Fri merge予定" / "Sat 20:00-23:00"）
  readonly desc: string; // 要約（例: "max_connections 100→40 に縮小"）
  readonly source: string; // 出所（例: "github.pr#123" / "schedule.seed" / "incident.7"）
};

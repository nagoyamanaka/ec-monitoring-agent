// 予兆ブリーフィングの出力（独立した read-model）。Alert ではない：
// 起点 MonitoringEvent が無く・未発生で・reviewStatus の意味も違うため、Alert 集約に相乗りさせない。
export const RiskLevel = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export type RiskItem = {
  readonly window: string; // 例: "Sat 20:00"
  readonly subject: string; // 例: "db.connection_pool"
  readonly level: RiskLevel;
  readonly confidence: number; // 0.0〜1.0（アダプタでクランプ）
  readonly citations: string[]; // 使った ForecastSignal.id。空は不正＝引用検証で落とす
  readonly reasoning: string; // 引用を踏まえた根拠文
  // 発火自体を防ぐために人間が今打てる先手（1文・任意）。LLM が出さなければ
  // フィールドごと欠落＝カードは先手行なしで成立する優雅な縮退（F11a）。
  readonly preventiveAction?: string;
};

/**
 * 引用検証（ハルシネーション・ガード）の会計（E6-1）。
 *
 * `verifyCitations()` は偽引用と裏付けゼロのリスクを**永続化の前に**落とすので、
 * 保存済み予報だけを見ると引用照合率は**定義上 100%** になる。測るべきなのは残った側ではなく
 * **落とした側**で、その値は現状ローカル変数として捨てられている（外に出るのは warn の文字列だけ）。
 * ここに載せるのは今すでに数えている値そのもので、判定ロジックは一切変えない。
 *
 * 追記フィールド（旧データは未設定）。ドキュメントは `RiskForecast` の射影なので、
 * Mongo 側のマッピングを書き足さずにそのまま同じ doc へ乗る。
 */
export type CitationVerificationStats = {
  readonly citationsEmitted: number; // LLM が出した引用の総数（検証前）
  readonly citationsDropped: number; // 実在しない id として落とした引用数
  readonly risksEmitted: number; // LLM が出したリスク数（検証前）
  readonly risksDropped: number; // 裏付けが1つも残らず丸ごと破棄したリスク数
};

export type RiskForecast = {
  readonly forecastId: string;
  readonly generatedAt: Date;
  readonly horizon: string; // 対象期間（例: "今週末"）
  readonly risks: RiskItem[]; // level 降順
  readonly isFallback: boolean; // 生成失敗時の縮退
  // 引用検証の会計（E6-1）。LLM を呼ばなかった予報（シグナル0件の空予報）には付かない。
  readonly verification?: CitationVerificationStats;
};

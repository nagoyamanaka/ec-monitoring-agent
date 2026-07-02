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
};

export type RiskForecast = {
  readonly forecastId: string;
  readonly generatedAt: Date;
  readonly horizon: string; // 対象期間（例: "今週末"）
  readonly risks: RiskItem[]; // level 降順
  readonly isFallback: boolean; // 生成失敗時の縮退
};

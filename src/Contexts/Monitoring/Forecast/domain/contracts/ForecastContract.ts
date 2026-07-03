// GET/POST /forecast の wire 契約（backend レスポンス＝frontend 表示射影の単一ソース）。
// frontend は @monitoring alias でここを直接 import する（AlertContract と同方針）。
// domain 型（RiskForecast/ForecastSignal）と構造は同型で、Date だけ ISO 文字列になる。

export type ForecastSignalPrimitives = {
  readonly id: string;
  readonly kind: string; // FUTURE_CHANGE | SCHEDULE | MEMORY
  readonly subject: string;
  readonly when: string;
  readonly desc: string;
  readonly source: string;
  // 証拠への deep link（PR html_url 等・任意）。引用チップが citation → 実在の証拠へ解決する。
  readonly url?: string;
};

export type RiskItemPrimitives = {
  readonly window: string;
  readonly subject: string;
  readonly level: "HIGH" | "MEDIUM" | "LOW";
  readonly confidence: number; // 0.0〜1.0
  readonly citations: string[]; // 引用検証済み＝実在する ForecastSignal.id のみ
  readonly reasoning: string;
};

export type RiskForecastPrimitives = {
  readonly forecastId: string;
  readonly generatedAt: string; // ISO 8601
  readonly horizon: string;
  readonly risks: RiskItemPrimitives[]; // level 降順
  readonly isFallback: boolean;
};

export type ForecastBriefingPrimitives = {
  readonly forecast: RiskForecastPrimitives;
  // 予報の根拠に使ったシグナル全量。citations の解決先（引用チップの表示素材）。
  readonly signals: ForecastSignalPrimitives[];
};

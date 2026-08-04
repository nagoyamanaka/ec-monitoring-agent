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
  // 発火自体を防ぐために人間が今打てる先手（1文・任意）。実行主体は人間＝
  // reactive の recommendedActions（事後対応）と意味が異なるため別名（F11a）。
  readonly preventiveAction?: string;
};

// 引用検証の会計（E6-1・domain CitationVerificationStats と同形）。
// 表示は analytics 側の集計（ForecastMeasurement）で行うが、予報1件ぶんの内訳も
// wire に出しておく（1件だけ見て「この予報で何を落としたか」が言える）。
export type CitationVerificationStatsPrimitives = {
  readonly citationsEmitted: number;
  readonly citationsDropped: number;
  readonly risksEmitted: number;
  readonly risksDropped: number;
};

export type RiskForecastPrimitives = {
  readonly forecastId: string;
  readonly generatedAt: string; // ISO 8601
  readonly horizon: string;
  readonly risks: RiskItemPrimitives[]; // level 降順
  readonly isFallback: boolean;
  // LLM を呼ばなかった予報（シグナル0件）と旧データには付かない。
  readonly verification?: CitationVerificationStatsPrimitives;
};

export type ForecastBriefingPrimitives = {
  readonly forecast: RiskForecastPrimitives;
  // 予報の根拠に使ったシグナル全量。citations の解決先（引用チップの表示素材）。
  readonly signals: ForecastSignalPrimitives[];
};

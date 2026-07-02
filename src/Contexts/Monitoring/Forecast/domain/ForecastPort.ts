import { ForecastContext } from "./ForecastContext.js";
import { RiskForecast } from "./RiskForecast.js";

// リスク予報生成の driven ポート（★F6 の差し替え点。実装: GeminiForecastAdapter）。
// 失敗（LLM 例外／パース不能）でも throw せず isFallback=true の縮退予報を返す＝
// Handler は fallback 分岐を持たない（LLMInvestigationAdapter と同じ契約）。
// citations の実在照合（偽引用を落とす）は本ポートの責務ではなく Handler 側（F5 引用検証）。
export interface ForecastPort {
  forecast(context: ForecastContext): Promise<RiskForecast>;
}

import type { ForecastApi } from "../infrastructure/forecastApi";
import type { ForecastBriefingView } from "../domain/ForecastView";

/**
 * デモ卓/予兆ページの「予報を生成」操作を POST /forecast へ橋渡しする application ユースケース。
 * POST は生成結果（引用検証済み・fallback 含む）を同期で返す契約（F6）＝ SSE を待たず
 * そのまま最新ブリーフィングとして画面へ反映できる。DEMO_ENABLED off（404）は呼び出し側で扱う。
 */
export async function triggerForecast(
  api: ForecastApi,
  signal?: AbortSignal,
): Promise<ForecastBriefingView> {
  return api.generate(signal);
}

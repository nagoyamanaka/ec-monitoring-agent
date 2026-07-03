import type { HttpClient } from "@shared/api/HttpClient";
import { HttpError } from "@shared/api/HttpClient";
import type { ForecastBriefingPrimitives } from "@monitoring/Forecast/domain/contracts/ForecastContract";
import {
  toForecastBriefingView,
  type ForecastBriefingView,
} from "../domain/ForecastView";

/**
 * 予兆ブリーフィングの REST アクセス（step6 F7）。HttpClient interface にのみ依存し、
 * wire（ForecastBriefingPrimitives）を domain 純関数で View へ写像して返す（analyticsApi と同流儀）。
 * - GET  /forecast … 事前生成済みの最新予報（Gemini 非呼び出し・無人閲覧向け）
 * - POST /forecast … 予報の生成（Gemini 課金あり・DEMO_ENABLED 配下）
 */

/**
 * GET /forecast の3状態。backend は 404 を2通り返すため body で区別する:
 * - forecastGuard（FORECAST_ENABLED=false）… `sendStatus(404)`＝非 JSON body → disabled
 * - ForecastGetController（キャッシュ未生成）… `{ error: ... }` JSON body → empty
 * ナビ表示（FORECAST_ENABLED off時は非表示）はこの区別だけで決まる＝専用 status API を増やさない。
 */
export type ForecastSnapshot =
  | { readonly kind: "disabled" }
  | { readonly kind: "empty" }
  | { readonly kind: "ready"; readonly briefing: ForecastBriefingView };

export interface ForecastApi {
  getLatest(signal?: AbortSignal): Promise<ForecastSnapshot>;
  /** 予報を生成して返す。DEMO_ENABLED off は HttpError(404) がそのまま伝播する。 */
  generate(signal?: AbortSignal): Promise<ForecastBriefingView>;
}

/** シグナル収集＋Gemini 1ショット合成で数十秒かかり得るため、生成だけ長めのタイムアウト。 */
const GENERATE_TIMEOUT_MS = 90_000;

export function createForecastApi(http: HttpClient): ForecastApi {
  return {
    async getLatest(signal) {
      try {
        const dto = await http.get<ForecastBriefingPrimitives>("/forecast", {
          signal,
        });
        return { kind: "ready", briefing: toForecastBriefingView(dto) };
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) {
          const isJsonBody = typeof e.body === "object" && e.body !== null;
          return { kind: isJsonBody ? "empty" : "disabled" };
        }
        throw e;
      }
    },

    async generate(signal) {
      const dto = await http.post<ForecastBriefingPrimitives>(
        "/forecast",
        undefined,
        { signal, timeoutMs: GENERATE_TIMEOUT_MS },
      );
      return toForecastBriefingView(dto);
    },
  };
}

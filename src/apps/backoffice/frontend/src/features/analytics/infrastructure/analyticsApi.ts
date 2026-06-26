import type { HttpClient } from "@shared/api/HttpClient";
import {
  type AnalyticsDto,
  type AnalyticsView,
  toAnalyticsView,
} from "../domain/AnalyticsView";

/**
 * Analytics の REST アクセス（GET /analytics）。HttpClient interface にのみ依存し、
 * 受信した AnalyticsDto を domain の純関数で AnalyticsView へ写像して返す（alertsApi と同流儀）。
 */
export interface AnalyticsApi {
  getAnalytics(signal?: AbortSignal): Promise<AnalyticsView>;
}

export function createAnalyticsApi(http: HttpClient): AnalyticsApi {
  return {
    async getAnalytics(signal) {
      const dto = await http.get<AnalyticsDto>("/analytics", { signal });
      return toAnalyticsView(dto);
    },
  };
}

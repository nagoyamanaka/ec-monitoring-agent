import type { AlertPrimitives } from "@monitoring/AlertAnalysis/domain/contracts/AlertContract";
import type { HttpClient } from "@shared/api/HttpClient";
import { type AlertView, toAlertView } from "../domain/AlertView";

/**
 * Alert の REST アクセス。HttpClient interface にのみ依存し、テスト時はモックに差し替える。
 * 受信した AlertPrimitives（共有ワイヤ契約）を domain の純関数で AlertView へ写像して返す。
 * エンドポイント: GET /alerts, GET /alerts/:id, PATCH /alerts/:id/feedback。
 */

/** PATCH /alerts/:id/feedback の body。承認/却下を isCorrect に正規化して送る。 */
export type SubmitFeedbackInput = {
  readonly isCorrect: boolean;
  readonly operatorNote?: string;
};

export interface AlertsApi {
  getAlerts(signal?: AbortSignal): Promise<AlertView[]>;
  getAlert(id: string, signal?: AbortSignal): Promise<AlertView>;
  submitFeedback(
    id: string,
    input: SubmitFeedbackInput,
    signal?: AbortSignal,
  ): Promise<void>;
}

type AlertsResponse = { alerts: AlertPrimitives[] };

export function createAlertsApi(http: HttpClient): AlertsApi {
  return {
    async getAlerts(signal) {
      const res = await http.get<AlertsResponse>("/alerts", { signal });
      return res.alerts.map(toAlertView);
    },

    async getAlert(id, signal) {
      const primitives = await http.get<AlertPrimitives>(
        `/alerts/${encodeURIComponent(id)}`,
        { signal },
      );
      return toAlertView(primitives);
    },

    async submitFeedback(id, input, signal) {
      await http.patch<unknown>(
        `/alerts/${encodeURIComponent(id)}/feedback`,
        input,
        { signal },
      );
    },
  };
}

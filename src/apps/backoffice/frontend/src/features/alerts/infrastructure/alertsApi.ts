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

/** POST /alerts/:id/reinvestigate の body。人間の指摘を AI 再調査の文脈へ渡す。 */
export type ReinvestigateInput = {
  readonly operatorNote: string;
};

export interface AlertsApi {
  getAlerts(signal?: AbortSignal): Promise<AlertView[]>;
  getAlert(id: string, signal?: AbortSignal): Promise<AlertView>;
  submitFeedback(
    id: string,
    input: SubmitFeedbackInput,
    signal?: AbortSignal,
  ): Promise<void>;
  /** 人間の指摘を添えて AI 再調査をキックする（202／結果は SSE で届く）。 */
  reinvestigate(
    id: string,
    input: ReinvestigateInput,
    signal?: AbortSignal,
  ): Promise<void>;
  /** 既知一致 Alert に今回paramでの AI 調査レポートをオンデマンド要求する（202／結果は SSE で届く）。 */
  requestReport(id: string, signal?: AbortSignal): Promise<void>;
  /** この Alert を回数不問で既知パターンへ手動即時昇格（結晶化）する。 */
  promote(id: string, signal?: AbortSignal): Promise<void>;
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

    async reinvestigate(id, input, signal) {
      await http.post<unknown>(
        `/alerts/${encodeURIComponent(id)}/reinvestigate`,
        input,
        { signal },
      );
    },

    async requestReport(id, signal) {
      await http.post<unknown>(
        `/alerts/${encodeURIComponent(id)}/report`,
        {},
        { signal },
      );
    },

    async promote(id, signal) {
      await http.post<unknown>(
        `/alerts/${encodeURIComponent(id)}/promote`,
        {},
        { signal },
      );
    },
  };
}

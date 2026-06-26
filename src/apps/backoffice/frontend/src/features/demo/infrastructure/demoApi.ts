import type { HttpClient } from "@shared/api/HttpClient";

/**
 * デモ操作の REST アクセス。HttpClient interface にのみ依存し、テストはモックに差し替える。
 * backend の /demo/*（DEMO_ENABLED=false なら demoGuard が 404）に対応する。
 * - GET  /demo/status                  … alert/パターン件数（現在状態）
 * - POST /demo/scenario/:id/trigger    … 障害シナリオ注入（202 受付・EC へ注文投入）
 * - POST /demo/payment-mode            … EC の決済モード切替
 * - POST /demo/reset                   … alert/パターンを seed 初期状態へ戻す
 *
 * デモ系は features/demo に閉じ込め、プロダクション UI（AlertsLayout 以外）を侵食しない。
 */

/** EC の決済モード。backend EcDemoGateway の PaymentMode と整合。 */
export type PaymentMode = "SUCCESS" | "RANDOM" | "TIMEOUT";

export type DemoStatus = {
  readonly demoEnabled: boolean;
  readonly totalAlerts: number;
  readonly promotedPatternCount: number;
  readonly patternCount: number;
};

export type ScenarioResult = {
  readonly scenarioId: string;
  readonly label: string;
  readonly orderId: string;
};

export type ResetResult = {
  readonly alertsSeeded: number;
  readonly patternsSeeded: number;
};

export interface DemoApi {
  getStatus(signal?: AbortSignal): Promise<DemoStatus>;
  /** 障害シナリオを注入する。Alert 化（SSE 配信）は非同期に届くので 202 受付のみ返る。 */
  triggerScenario(id: string, signal?: AbortSignal): Promise<ScenarioResult>;
  setPaymentMode(mode: PaymentMode, signal?: AbortSignal): Promise<void>;
  reset(signal?: AbortSignal): Promise<ResetResult>;
}

export function createDemoApi(http: HttpClient): DemoApi {
  return {
    getStatus(signal) {
      return http.get<DemoStatus>("/demo/status", { signal });
    },

    triggerScenario(id, signal) {
      return http.post<ScenarioResult>(
        `/demo/scenario/${encodeURIComponent(id)}/trigger`,
        undefined,
        { signal },
      );
    },

    async setPaymentMode(mode, signal) {
      await http.post<unknown>("/demo/payment-mode", { mode }, { signal });
    },

    reset(signal) {
      return http.post<ResetResult>("/demo/reset", undefined, { signal });
    },
  };
}

import type { HttpClient } from "@shared/api/HttpClient";

/**
 * デモ操作の REST アクセス。HttpClient interface にのみ依存し、テストはモックに差し替える。
 * backend の /demo/*（DEMO_ENABLED=false なら demoGuard が 404）に対応する。
 * - GET  /demo/status                  … alert/パターン件数（現在状態）
 * - POST /demo/scenario/:id/trigger    … 障害シナリオ注入（202 受付・EC へ注文投入 or インフラ障害注入）
 * - POST /demo/reset                   … alert/パターンを seed 初期状態へ戻す
 *
 * 決済モード等の低レベル設定は単独 UI を持たず、シナリオ注入（TriggerDemoScenarioUseCase）が
 * EC へ内部的に設定する＝「設定＋発火」を1ユースケースに閉じる方針（裸のモードトグルは廃止）。
 * デモ系は features/demo に閉じ込め、プロダクション UI（AlertsLayout 以外）を侵食しない。
 */

export type DemoStatus = {
  readonly demoEnabled: boolean;
  readonly totalAlerts: number;
  /** 現役（非 RESOLVED）件数。一覧と同じ軸＝状態タイルはこちらを出す。 */
  readonly activeAlerts: number;
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

    reset(signal) {
      return http.post<ResetResult>("/demo/reset", undefined, { signal });
    },
  };
}

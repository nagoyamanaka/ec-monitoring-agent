import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "@shared/api/HttpClient";
import type {
  DemoApi,
  DemoStatus,
  PaymentMode,
} from "../../infrastructure/demoApi";

export interface UseDemoControls {
  /** デモが有効か（/demo/status が 404 でない）。false ならドロワーを出さない。 */
  readonly available: boolean;
  /** 初回 status 取得が完了したか判定中か。 */
  readonly loading: boolean;
  readonly status: DemoStatus | null;
  readonly error: Error | null;
  /** 実行中アクションの識別子（例 "scenario:1"・"payment:TIMEOUT"・"reset"）。null なら待機中。 */
  readonly busy: string | null;
  /** 決済モードトグルの選択値（楽観的なローカル状態）。 */
  readonly paymentMode: PaymentMode;
  triggerScenario(id: string): Promise<void>;
  setPaymentMode(mode: PaymentMode): Promise<void>;
  reset(): Promise<void>;
  refresh(): Promise<void>;
}

/**
 * デモ操作（シナリオ注入・決済モード・リセット）と現在状態（件数）を束ねるフック。
 * - 初回に /demo/status を取得。404（DEMO 無効）なら available=false にしてドロワーを伏せられるようにする。
 * - 各 mutation は backend が件数のみ更新するので、**成功後に status を再取得**して件数へ反映する。
 * - 単一の busy で多重実行を抑止（デモ操作は同時押し不要なので1本に集約）。
 */
export function useDemoControls(
  api: DemoApi,
  { onAfterReset }: { onAfterReset?: () => void } = {},
): UseDemoControls {
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paymentMode, setPaymentModeState] = useState<PaymentMode>("SUCCESS");

  // unmount 後の setState を避けるためのフラグ。
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadStatus = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await api.getStatus(signal);
        if (!mountedRef.current) return;
        setStatus(next);
        setAvailable(true);
        setError(null);
      } catch (e) {
        if (signal?.aborted) return;
        if (!mountedRef.current) return;
        // 404 = DEMO_ENABLED=false（demoGuard）。エラーではなく「デモ無効」として伏せる。
        if (e instanceof HttpError && e.status === 404) {
          setAvailable(false);
          return;
        }
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [api],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    loadStatus(ctrl.signal).finally(() => {
      if (mountedRef.current) setLoading(false);
    });
    return () => ctrl.abort();
  }, [loadStatus]);

  const refresh = useCallback(() => loadStatus(), [loadStatus]);

  // mutation 共通: 多重実行を抑止し、成功後に status を再取得する。
  const runAction = useCallback(
    async (id: string, action: () => Promise<void>) => {
      if (!mountedRef.current) return;
      setBusy(id);
      setError(null);
      try {
        await action();
        await loadStatus();
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (mountedRef.current) setBusy(null);
      }
    },
    [loadStatus],
  );

  const triggerScenario = useCallback(
    (sid: string) =>
      runAction(`scenario:${sid}`, async () => {
        await api.triggerScenario(sid);
      }),
    [api, runAction],
  );

  const setPaymentMode = useCallback(
    (mode: PaymentMode) =>
      runAction(`payment:${mode}`, async () => {
        await api.setPaymentMode(mode);
        if (mountedRef.current) setPaymentModeState(mode);
      }),
    [api, runAction],
  );

  const reset = useCallback(
    () =>
      runAction("reset", async () => {
        await api.reset();
        onAfterReset?.();
      }),
    [api, runAction, onAfterReset],
  );

  return {
    available,
    loading,
    status,
    error,
    busy,
    paymentMode,
    triggerScenario,
    setPaymentMode,
    reset,
    refresh,
  };
}

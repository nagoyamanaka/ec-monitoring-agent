import { useCallback, useEffect, useRef, useState } from "react";
import { HttpError } from "@shared/api/HttpClient";
import type { DemoApi, DemoStatus } from "../../infrastructure/demoApi";

/** シナリオ注入時のオプション。UI（ScenarioControls）から realness に応じて渡す。 */
export interface TriggerOptions {
  /**
   * 実検知経路（Cloud Monitoring 発報）で Alert 化まで数十秒かかるシナリオか。
   * true のとき、POST 受付後も「検知待ち」状態を保持して待機ナレーションを出す
   * （POST は 202 で即返るが、実際のアラート着弾は SSE で遅れて届くため）。
   */
  readonly awaitDetection?: boolean;
  /** 待機バナーに出すシナリオ名。 */
  readonly label?: string;
  /**
   * 検知待ちを「当のアラート」の着弾で畳むための照合カテゴリ（例 "INFRASTRUCTURE"）。
   * 指定すると、この category の新規アラート受信でのみバナーを閉じる（他シナリオの更新・
   * remediation では閉じない）。未指定なら最初の受信で閉じる（緩いフォールバック）。
   */
  readonly matchCategory?: string;
}

/**
 * 実検知経路の「検知待ち」状態。POST 受付〜SSE でアラートが着弾するまでの間だけ立つ。
 * busy（POST 実行中）とは別軸: busy は 1〜2 秒で解けるが、実発報の着弾は数十秒遅れる。
 */
export interface PendingDetection {
  readonly scenarioId: string;
  readonly label: string;
  /** 検知待ちを開始した時刻（epoch ms）。経過表示に使う。 */
  readonly startedAt: number;
  /** 着弾で畳むために照合するアラート category（未指定なら最初の受信で畳む）。 */
  readonly matchCategory?: string;
}

export interface UseDemoControls {
  /** デモが有効か（/demo/status が 404 でない）。false ならドロワーを出さない。 */
  readonly available: boolean;
  /** 初回 status 取得が完了したか判定中か。 */
  readonly loading: boolean;
  readonly status: DemoStatus | null;
  readonly error: Error | null;
  /** 実行中アクションの識別子（例 "scenario:1"・"reset"）。null なら待機中。 */
  readonly busy: string | null;
  /** 実検知経路の注入後、アラート着弾を待っている状態。null なら待機なし。 */
  readonly pendingDetection: PendingDetection | null;
  triggerScenario(id: string, opts?: TriggerOptions): Promise<void>;
  reset(): Promise<void>;
  refresh(): Promise<void>;
  /** 検知待ちを明示的に解除する（SSE 着弾検知・手動 dismiss から呼ぶ）。 */
  clearPendingDetection(): void;
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
  const [pendingDetection, setPendingDetection] =
    useState<PendingDetection | null>(null);

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

  const clearPendingDetection = useCallback(() => {
    if (mountedRef.current) setPendingDetection(null);
  }, []);

  // mutation 共通: 多重実行を抑止し、成功後に status を再取得する。
  // 新しい操作を始めるとき、前回の「検知待ち」バナーは畳む（reset・別シナリオ注入で消える）。
  const runAction = useCallback(
    async (id: string, action: () => Promise<void>) => {
      if (!mountedRef.current) return;
      setBusy(id);
      setError(null);
      setPendingDetection(null);
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
    (sid: string, opts?: TriggerOptions) =>
      runAction(`scenario:${sid}`, async () => {
        await api.triggerScenario(sid);
        // 実検知経路は POST 受付（202）後もアラート着弾まで数十秒かかる。
        // busy が解けたあとも「検知待ち」を立てて待機ナレーションを継続する。
        if (opts?.awaitDetection && mountedRef.current) {
          setPendingDetection({
            scenarioId: sid,
            label: opts.label ?? "障害",
            startedAt: Date.now(),
            ...(opts.matchCategory !== undefined
              ? { matchCategory: opts.matchCategory }
              : {}),
          });
        }
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
    pendingDetection,
    triggerScenario,
    reset,
    refresh,
    clearPendingDetection,
  };
}

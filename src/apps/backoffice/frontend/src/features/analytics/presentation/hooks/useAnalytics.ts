import { useCallback, useEffect, useState } from "react";
import type { AnalyticsApi } from "../../infrastructure/analyticsApi";
import type { AnalyticsView } from "../../domain/AnalyticsView";

export type AnalyticsStatus = "loading" | "ready" | "error";

export type UseAnalyticsResult = {
  readonly analytics: AnalyticsView | null;
  readonly status: AnalyticsStatus;
  readonly error: Error | null;
  /** 手動再取得（更新ボタン用）。 */
  readonly refresh: () => Promise<void>;
};

/**
 * Analytics 集計の取得 hook（マウント時 fetch ＋ 手動 refresh）。
 * 集計はサーバ側で全 Alert を畳む read モデルなので SSE には乗せず pull on-demand
 * （step4-1 §10「大きい/集約は pull」）。ページ訪問のたび最新を取り直す。
 */
export function useAnalytics(api: AnalyticsApi): UseAnalyticsResult {
  const [analytics, setAnalytics] = useState<AnalyticsView | null>(null);
  const [status, setStatus] = useState<AnalyticsStatus>("loading");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStatus("loading");
    setError(null);

    api
      .getAnalytics(controller.signal)
      .then((view) => {
        if (!active) return;
        setAnalytics(view);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus("error");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [api]);

  const refresh = useCallback(async () => {
    const view = await api.getAnalytics();
    setAnalytics(view);
  }, [api]);

  return { analytics, status, error, refresh };
}

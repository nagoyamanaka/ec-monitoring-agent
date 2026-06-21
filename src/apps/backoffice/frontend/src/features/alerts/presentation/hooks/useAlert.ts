import { useCallback, useEffect, useState } from "react";
import type { AlertView } from "../../domain/AlertView";
import type { AlertsApi } from "../../infrastructure/alertsApi";
import type { AlertsStatus } from "./useAlerts";

export type UseAlertResult = {
  readonly alert: AlertView | null;
  readonly status: AlertsStatus;
  readonly error: Error | null;
  /** 再取得して反映する。フィードバック送信後の reviewStatus 即時反映に使う。 */
  readonly refresh: () => Promise<void>;
};

/**
 * 単一 alert の取得 hook（詳細ページ用）。useAlerts と同じ loading/error 遷移を踏襲。
 * id が変われば再取得し、unmount/再取得時は AbortController で前のリクエストを中断する。
 */
export function useAlert(
  api: AlertsApi,
  id: string | undefined,
): UseAlertResult {
  const [alert, setAlert] = useState<AlertView | null>(null);
  const [status, setStatus] = useState<AlertsStatus>("loading");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setStatus("error");
      setError(new Error("alert id is missing"));
      return;
    }
    const controller = new AbortController();
    let active = true;
    setStatus("loading");
    setError(null);

    api
      .getAlert(id, controller.signal)
      .then((fetched) => {
        if (!active) return;
        setAlert(fetched);
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
  }, [api, id]);

  const refresh = useCallback(async () => {
    if (!id) return;
    const fresh = await api.getAlert(id);
    setAlert(fresh);
  }, [api, id]);

  return { alert, status, error, refresh };
}

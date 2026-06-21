import { useEffect, useState } from "react";
import type { AlertView } from "../../domain/AlertView";
import { mergeAlert, mergeAlerts } from "../../domain/alertMerge";
import type { AlertsApi } from "../../infrastructure/alertsApi";
import type { AlertStream } from "../../infrastructure/AlertStream";
import { useAlertStream } from "./useAlertStream";

export type AlertsStatus = "loading" | "ready" | "error";

export type UseAlertsResult = {
  readonly alerts: AlertView[];
  readonly status: AlertsStatus;
  readonly error: Error | null;
};

/**
 * 一覧の初回取得 ＋ SSE ストリームのマージを束ねる画面向け hook。
 * api / stream は注入（テスト時はモックへ差し替え）。
 * - 初回 GET /alerts を取得し status を loading→ready/error 遷移
 * - 取得解決時、解決前に届いていた stream 分（prev）を mergeAlerts で取りこぼさない
 * - 以降のストリーム受信は mergeAlert で同一 ID 置換（ANALYZING→OPEN 遷移を反映）
 */
export function useAlerts(api: AlertsApi, stream: AlertStream): UseAlertsResult {
  const [alerts, setAlerts] = useState<AlertView[]>([]);
  const [status, setStatus] = useState<AlertsStatus>("loading");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setStatus("loading");
    setError(null);

    api
      .getAlerts(controller.signal)
      .then((fetched) => {
        if (!active) return;
        // fetch 解決前に stream で先着していた分を土台へ畳み込む
        setAlerts((prev) => mergeAlerts(fetched, prev));
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

  useAlertStream(stream, (incoming) => {
    setAlerts((prev) => mergeAlert(prev, incoming));
  });

  return { alerts, status, error };
}

import { useCallback, useEffect, useState } from "react";
import type { AlertView } from "../../domain/AlertView";
import type { AlertsApi } from "../../infrastructure/alertsApi";
import type { AlertStream } from "../../infrastructure/AlertStream";
import type { AlertsStatus } from "./useAlerts";
import { useAlertStream } from "./useAlertStream";

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
 *
 * stream（任意）を渡すと、同一 id の SSE push を取り込んで alert をライブ更新する。
 * これにより詳細ページでも ANALYZING→OPEN 遷移が反映され、証拠パネル（SSE 駆動）が一覧ドロワーと
 * 同じ挙動になる（status のポーリングをせずに済む・段階1の設計統一）。
 */
export function useAlert(
  api: AlertsApi,
  id: string | undefined,
  stream?: AlertStream,
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

  // SSE: このページが見ている id の push だけ取り込んで置換する（他は無視）。
  // stream 未指定（テスト等）は no-op の MockAlertStream を渡す呼び出し側に委ねる。
  useAlertStream(stream ?? NULL_STREAM, (incoming) => {
    if (incoming.id === id) setAlert(incoming);
  });

  const refresh = useCallback(async () => {
    if (!id) return;
    const fresh = await api.getAlert(id);
    setAlert(fresh);
  }, [api, id]);

  return { alert, status, error, refresh };
}

/** stream 未指定時の no-op ストリーム（購読しても何も流れない）。 */
const NULL_STREAM: AlertStream = {
  subscribe: () => () => {},
};

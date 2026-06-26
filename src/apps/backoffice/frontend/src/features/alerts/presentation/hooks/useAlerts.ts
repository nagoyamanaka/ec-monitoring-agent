import { useCallback, useEffect, useState } from "react";
import type { AlertView } from "../../domain/AlertView";
import { mergeAlert, mergeAlerts } from "../../domain/alertMerge";
import { type RemediationView, toRemediationView } from "../../domain/RemediationView";
import type { AlertsApi } from "../../infrastructure/alertsApi";
import type { AlertStream, StreamStatus } from "../../infrastructure/AlertStream";
import { useAlertStream } from "./useAlertStream";

export type AlertsStatus = "loading" | "ready" | "error";

export type UseAlertsResult = {
  readonly alerts: AlertView[];
  readonly status: AlertsStatus;
  readonly error: Error | null;
  /** SSE 接続状態（ライブ表示用）。初期値は "connecting"。 */
  readonly streamStatus: StreamStatus;
  /** 最後に一覧へ反映が入った時刻（初回取得・SSE 受信・再取得）。未反映は null。 */
  readonly lastUpdatedAt: Date | null;
  /** 1 件を再取得して一覧へマージする。フィードバック送信後の即時反映に使う（SSE push が無いため）。 */
  readonly refreshAlert: (id: string) => Promise<void>;
  /** SSE が切断状態のとき、自動タイマーを待たず即時再接続する。 */
  readonly reconnectStream: () => void;
  /** SSE "remediation" イベントで届いた最新のリメディ確定（alertId→View）。ドロワーへ live 反映する。 */
  readonly remediationByAlertId: ReadonlyMap<string, RemediationView>;
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
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [remediationByAlertId, setRemediationByAlertId] = useState<
    ReadonlyMap<string, RemediationView>
  >(new Map());

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
        setLastUpdatedAt(new Date());
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

  useAlertStream(
    stream,
    (incoming) => {
      setAlerts((prev) => mergeAlert(prev, incoming));
      setLastUpdatedAt(new Date());
    },
    (s) => setStreamStatus(s),
    (remediation) => {
      const view = toRemediationView(remediation);
      setRemediationByAlertId((prev) => {
        const next = new Map(prev);
        next.set(view.alertId, view);
        return next;
      });
      setLastUpdatedAt(new Date());
    },
  );

  const refreshAlert = useCallback(
    async (id: string) => {
      const fresh = await api.getAlert(id);
      setAlerts((prev) => mergeAlert(prev, fresh));
      setLastUpdatedAt(new Date());
    },
    [api],
  );

  const reconnectStream = useCallback(() => stream.reconnect?.(), [stream]);

  return {
    alerts,
    status,
    error,
    streamStatus,
    lastUpdatedAt,
    refreshAlert,
    reconnectStream,
    remediationByAlertId,
  };
}

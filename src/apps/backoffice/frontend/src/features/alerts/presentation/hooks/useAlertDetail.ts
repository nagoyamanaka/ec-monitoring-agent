import { useCallback, useEffect, useState } from "react";
import { HttpError } from "@shared/api/HttpClient";
import type { AlertView } from "../../domain/AlertView";
import type { AlertsApi } from "../../infrastructure/alertsApi";
import type { AlertsStatus } from "./useAlerts";

/**
 * 詳細ページが見る「この1件のアラート」を単一のインターフェースで返す（二源の継ぎ目を隠す）。
 *
 * アラートには2つのライフサイクルがあり、源が分かれるのは偶然ではなく本質:
 *  - 現役（一覧 GET /alerts に居る）: 共有一覧 state から即表示＋SSE ライブ反映
 *    （ANALYZING→OPEN・証拠 done・リメディ確定が再 fetch なしで追従）。
 *  - 解決済みアーカイブ（RESOLVED＝一覧 API から除外）: 予兆 MEMORY 引用・類似の関連アラートの
 *    ディープリンク先。クライアントに存在しないので GET /alerts/:id で単品取得する（遅延ロード
 *    ＝開いた1件だけを開いた瞬間に取る）。取得結果は**共有一覧へ merge しない**＝一覧に RESOLVED
 *    が混入しない。
 *
 * 呼び出し側（AlertDetailPage）はこの2源を意識せず `{ alert, status, refresh }` だけを使う。
 * 依存は引数で受ける（`useAlertsData` を内部で呼ばない）＝fake 注入で分岐を UT できる。
 */
export type AlertDetailStatus = "loading" | "ready" | "notfound" | "error";

export type AlertDetailState = {
  readonly alert: AlertView | null;
  readonly status: AlertDetailStatus;
  /** 操作後の再取得。現役は共有 state へ merge、アーカイブはローカル単品再取得（源に合わせる）。 */
  readonly refresh: (alertId: string) => Promise<void>;
};

export type UseAlertDetailParams = {
  readonly id: string | undefined;
  readonly alerts: readonly AlertView[];
  readonly listStatus: AlertsStatus;
  readonly refreshAlert: (id: string) => Promise<void>;
  readonly api: AlertsApi;
};

export function useAlertDetail({
  id,
  alerts,
  listStatus,
  refreshAlert,
  api,
}: UseAlertDetailParams): AlertDetailState {
  const listAlert = id ? alerts.find((a) => a.id === id) ?? null : null;
  // アーカイブ取得は「一覧が確定して、かつ一覧に居ない」ときだけ（現役は共有 state が正）。
  const archiveEnabled = listStatus === "ready" && listAlert === null;

  const [archiveAlert, setArchiveAlert] = useState<AlertView | null>(null);
  // 取得結果の確定状態。archiveEnabled でない間は使われない（listAlert 分岐が勝つ）。
  const [archiveStatus, setArchiveStatus] = useState<
    "loading" | "ready" | "notfound" | "error"
  >("loading");

  useEffect(() => {
    if (!id || !archiveEnabled) {
      setArchiveAlert(null);
      setArchiveStatus("loading");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setArchiveStatus("loading");
    api.getAlert(id, controller.signal).then(
      (fresh) => {
        if (cancelled) return;
        setArchiveAlert(fresh);
        setArchiveStatus("ready");
      },
      (e: unknown) => {
        if (cancelled) return;
        setArchiveAlert(null);
        // 404＝存在しない id（notfound）。それ以外の失敗は error に分ける。
        setArchiveStatus(
          e instanceof HttpError && e.status === 404 ? "notfound" : "error",
        );
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, id, archiveEnabled]);

  const alert = listAlert ?? archiveAlert;
  const status: AlertDetailStatus =
    listStatus !== "ready"
      ? listStatus // loading / error はそのまま伝播
      : listAlert
        ? "ready"
        : archiveStatus; // アーカイブ取得の確定状態（loading→ready/notfound/error）

  const refresh = useCallback(
    async (alertId: string) => {
      if (alerts.some((a) => a.id === alertId)) {
        await refreshAlert(alertId);
        return;
      }
      // アーカイブ単品再取得（共有 state へは merge しない）。
      const fresh = await api.getAlert(alertId);
      setArchiveAlert(fresh);
      setArchiveStatus("ready");
    },
    [alerts, refreshAlert, api],
  );

  return { alert, status, refresh };
}

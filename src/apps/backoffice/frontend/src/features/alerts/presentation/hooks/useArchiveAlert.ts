import { useCallback, useEffect, useState } from "react";
import { HttpError } from "@shared/api/HttpClient";
import type { AlertView } from "../../domain/AlertView";
import type { AlertsApi } from "../../infrastructure/alertsApi";

/**
 * 解決済みアーカイブ Alert のフォールバック取得（詳細ページ用）。
 * 一覧（GET /alerts）は RESOLVED を除外するため、共有一覧 state に無い id への
 * ディープリンク（予兆の MEMORY 引用「当時のアラートを開く」・類似分類の関連アラート）は
 * ここで GET /alerts/:id を直接引いて解決する。
 * enabled＝「一覧が ready かつ一覧に居ない」ときだけ発火（現役アラートは一覧 state が正）。
 * 取得結果は共有一覧へ merge しない＝RESOLVED が一覧ページへ混入しない（ローカル state 限り）。
 */
export type ArchiveAlertStatus =
  | "idle"
  | "loading"
  | "ready"
  | "notfound"
  | "error";

export type ArchiveAlertState = {
  readonly alert: AlertView | null;
  readonly status: ArchiveAlertStatus;
  /** フィードバック等の後に単品を再取得する（一覧 merge を経由しない）。 */
  readonly refresh: () => Promise<void>;
};

export function useArchiveAlert(
  api: AlertsApi,
  id: string | undefined,
  enabled: boolean,
): ArchiveAlertState {
  const [alert, setAlert] = useState<AlertView | null>(null);
  const [status, setStatus] = useState<ArchiveAlertStatus>("idle");

  useEffect(() => {
    if (!id || !enabled) {
      setAlert(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setStatus("loading");
    api.getAlert(id, controller.signal).then(
      (fresh) => {
        if (cancelled) return;
        setAlert(fresh);
        setStatus("ready");
      },
      (e: unknown) => {
        if (cancelled) return;
        setAlert(null);
        setStatus(
          e instanceof HttpError && e.status === 404 ? "notfound" : "error",
        );
      },
    );
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, id, enabled]);

  const refresh = useCallback(async () => {
    if (!id || !enabled) return;
    const fresh = await api.getAlert(id);
    setAlert(fresh);
    setStatus("ready");
  }, [api, id, enabled]);

  return { alert, status, refresh };
}

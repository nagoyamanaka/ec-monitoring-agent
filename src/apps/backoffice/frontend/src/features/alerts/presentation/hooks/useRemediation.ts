import { useCallback, useEffect, useState } from "react";
import {
  isRemediationPending,
  type RemediationView,
} from "../../domain/RemediationView";
import type { RemediationApi } from "../../infrastructure/remediationApi";
import { triggerRemediation } from "../../application/triggerRemediation";
import type { AlertsStatus } from "./useAlerts";

/** dispatched 確定待ちのポーリング間隔（ms）。 */
const DEFAULT_POLL_INTERVAL_MS = 2000;

export type UseRemediationResult = {
  readonly remediation: RemediationView | null;
  readonly status: AlertsStatus;
  readonly error: Error | null;
  /** 起票中（POST 送信中）か。ボタンの送信中表示に使う。 */
  readonly submitting: boolean;
  /** 修正を起票し、202 受付後に再取得して状態へ反映する。 */
  readonly draft: () => Promise<void>;
};

/**
 * リメディエーション状態の取得 hook。初回取得に加え、status が dispatched の間は
 * GET /remediation をポーリングして drafted/failed/skipped への確定を反映する
 * （dispatch callback は SSE push が無いため）。
 * draft() は起票（POST）後に再取得する（202＋mutation 後再取得の共通原則）。
 */
export function useRemediation(
  api: RemediationApi,
  alertId: string | null,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): UseRemediationResult {
  const [remediation, setRemediation] = useState<RemediationView | null>(null);
  const [status, setStatus] = useState<AlertsStatus>("loading");
  const [error, setError] = useState<Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 初回取得
  useEffect(() => {
    if (!alertId) return;
    const controller = new AbortController();
    let active = true;
    setStatus("loading");
    setError(null);

    api
      .getRemediation(alertId, controller.signal)
      .then((r) => {
        if (!active) return;
        setRemediation(r);
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
  }, [api, alertId]);

  const refresh = useCallback(async () => {
    if (!alertId) return;
    const fresh = await api.getRemediation(alertId);
    setRemediation(fresh);
  }, [api, alertId]);

  // dispatched の間だけポーリング。確定（drafted/failed/skipped）に変われば自動で止まる。
  const pending = remediation !== null && isRemediationPending(remediation);
  useEffect(() => {
    if (!pending || !alertId) return;
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      // 失敗しても最後の状態を保持し、次のポーリング機会に委ねる
      void refresh().catch(() => {});
    }, pollIntervalMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // remediation を依存に含め、ポーリング後（新オブジェクト）に再スケジュールさせる
  }, [pending, alertId, pollIntervalMs, refresh, remediation]);

  const draft = useCallback(async () => {
    if (!alertId || submitting) return;
    setSubmitting(true);
    try {
      await triggerRemediation(api, alertId);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }, [api, alertId, submitting, refresh]);

  return { remediation, status, error, submitting, draft };
}

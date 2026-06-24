import { useCallback, useEffect, useState } from "react";
import {
  isRemediationPending,
  type RemediationView,
} from "../../domain/RemediationView";
import type { RemediationApi } from "../../infrastructure/remediationApi";
import { triggerRemediation } from "../../application/triggerRemediation";
import type { AlertsStatus } from "./useAlerts";

/** live=false 時のフォールバックのポーリング間隔（ms）。 */
const DEFAULT_POLL_INTERVAL_MS = 2000;

export type UseRemediationOptions = {
  /** SSE "remediation" で届いた最新の確定。変化したら即 state へ反映する。 */
  readonly pushed?: RemediationView | null;
  /** SSE で更新が届く前提か。true ならポーリングしない（push 駆動）。 */
  readonly live?: boolean;
  /** live=false 時のポーリング間隔（ms）。テストで短縮する。 */
  readonly pollIntervalMs?: number;
};

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
 * リメディエーション状態の取得 hook。初回に GET /remediation を pull（ドロワーを開いた人だけ）。
 * 確定（dispatched→drafted/failed）は SSE "remediation" イベントで届くため、live=true なら
 * pushed を取り込むだけでポーリングはしない（段階2の設計統一）。
 * stream を渡せない経路（live=false）では dispatched の間だけポーリングするフォールバックを残す。
 * draft() は起票（POST）後に再取得する（202＋mutation 後再取得の共通原則）。
 */
export function useRemediation(
  api: RemediationApi,
  alertId: string | null,
  options: UseRemediationOptions = {},
): UseRemediationResult {
  const { pushed = null, live = false, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } =
    options;

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

  // SSE push の取り込み（live 経路）。該当アラートの確定だけ反映する。
  useEffect(() => {
    if (!pushed || pushed.alertId !== alertId) return;
    setRemediation(pushed);
  }, [pushed, alertId]);

  const refresh = useCallback(async () => {
    if (!alertId) return;
    const fresh = await api.getRemediation(alertId);
    setRemediation(fresh);
  }, [api, alertId]);

  // フォールバック: live でないときだけ dispatched をポーリングして確定に追従する。
  const pending = remediation !== null && isRemediationPending(remediation);
  useEffect(() => {
    if (live || !pending || !alertId) return;
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      void refresh().catch(() => {});
    }, pollIntervalMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [live, pending, alertId, pollIntervalMs, refresh, remediation]);

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

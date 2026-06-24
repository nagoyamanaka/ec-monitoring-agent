import { useEffect, useRef, useState } from "react";
import { type AlertView, isAnalyzing } from "../../domain/AlertView";
import type { EvidenceView } from "../../domain/EvidenceView";
import type { EvidenceApi } from "../../infrastructure/evidenceApi";

export type EvidencePhase = "analyzing" | "done" | "error";

export type UseEvidenceResult = {
  /** analyzing=調査中で証拠未着 / done=証拠取得済み / error=取得失敗。 */
  readonly phase: EvidencePhase;
  readonly evidence: EvidenceView | null;
  readonly error: Error | null;
};

/**
 * 証拠の取得 hook。調査の「完了」判定は **SSE で更新される alert.status** から導出し、
 * status エンドポイントのポーリングはしない（同じ事実を二重に持たない・段階1の設計統一）。
 * 分析中（ANALYZING）の間は証拠未着、done（OPEN=既知 or 調査レポート添付）になった瞬間に
 * 証拠を 1 回だけ fetch する。alert は親が SSE ライブで渡す（ドロワー＝alerts.find / 詳細＝useAlert+stream）。
 *
 * 証拠は外部 API（Cloud Logging/Terraform/GitHub）を叩く重い pull なので、
 * 全クライアントへ broadcast せず「ドロワーを開いた人が done になった時だけ」取得する。
 */
export function useEvidence(
  api: EvidenceApi,
  alert: AlertView | null,
): UseEvidenceResult {
  const [evidence, setEvidence] = useState<EvidenceView | null>(null);
  const [phase, setPhase] = useState<EvidencePhase>("analyzing");
  const [error, setError] = useState<Error | null>(null);
  // 同一アラートの done に対して二重 fetch しないためのガード。
  const fetchedFor = useRef<string | null>(null);

  const alertId = alert?.id ?? null;
  const done = alert !== null && !isAnalyzing(alert);

  useEffect(() => {
    if (!alertId) return;

    if (!done) {
      // 分析中（または別アラートへ切替）: 証拠をリセットし完了を待つ。
      setPhase("analyzing");
      setEvidence(null);
      setError(null);
      fetchedFor.current = null;
      return;
    }

    if (fetchedFor.current === alertId) return; // 取得済みなら何もしない
    fetchedFor.current = alertId;

    const controller = new AbortController();
    let cancelled = false;
    setError(null);

    api
      .getEvidence(alertId, controller.signal)
      .then((fetched) => {
        if (cancelled) return;
        setEvidence(fetched);
        setPhase("done");
      })
      .catch((e: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        fetchedFor.current = null; // 失敗は再試行余地を残す
        setError(e instanceof Error ? e : new Error(String(e)));
        setPhase("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [api, alertId, done]);

  return { phase, evidence, error };
}

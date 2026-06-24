import { useEffect, useState } from "react";
import type {
  EvidenceView,
  InvestigationStatus,
} from "../../domain/EvidenceView";
import type { EvidenceApi } from "../../infrastructure/evidenceApi";

/** 段階ポーリングのデフォルト間隔（ms）。 */
const DEFAULT_POLL_INTERVAL_MS = 1500;

export type EvidencePhase = InvestigationStatus | "error";

export type UseEvidenceResult = {
  /** 調査の段階。collecting/analyzing の間はポーリング継続、done で証拠 fetch 済み。 */
  readonly phase: EvidencePhase;
  /** done に到達して取得した証拠。それ以前は null。 */
  readonly evidence: EvidenceView | null;
  readonly error: Error | null;
};

/**
 * 証拠の取得 hook。GET /investigation/status を done になるまでポーリングし、
 * done になったタイミングで GET /evidence を一度だけ取得する（積み上げ演出のトリガー）。
 * alertId が変われば再開し、unmount/再開時は AbortController と cancel フラグで前処理を中断する。
 */
export function useEvidence(
  api: EvidenceApi,
  alertId: string | null,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): UseEvidenceResult {
  const [phase, setPhase] = useState<EvidencePhase>("collecting");
  const [evidence, setEvidence] = useState<EvidenceView | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!alertId) return;

    const controller = new AbortController();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    setPhase("collecting");
    setEvidence(null);
    setError(null);

    const fail = (e: unknown) => {
      if (cancelled || controller.signal.aborted) return;
      setError(e instanceof Error ? e : new Error(String(e)));
      setPhase("error");
    };

    const poll = async () => {
      try {
        const { status } = await api.getInvestigationStatus(
          alertId,
          controller.signal,
        );
        if (cancelled) return;

        if (status === "done") {
          const fetched = await api.getEvidence(alertId, controller.signal);
          if (cancelled) return;
          setEvidence(fetched);
          setPhase("done");
          return;
        }

        setPhase(status);
        timer = setTimeout(poll, pollIntervalMs);
      } catch (e) {
        fail(e);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [api, alertId, pollIntervalMs]);

  return { phase, evidence, error };
}

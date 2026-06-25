import { useCallback, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { FetchHttpClient } from "@shared/api/FetchHttpClient";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { createAlertsApi } from "../infrastructure/alertsApi";
import { createEvidenceApi } from "../infrastructure/evidenceApi";
import { createRemediationApi } from "../infrastructure/remediationApi";
import { SSEAlertStream } from "../infrastructure/SSEAlertStream";
import { hasAiInvestigation } from "../domain/AlertView";
import { useAlert } from "../presentation/hooks/useAlert";
import {
  submitFeedback,
  type FeedbackDecision,
} from "../application/submitFeedback";
import { reinvestigate } from "../application/reinvestigate";
import { AlertCardExpanded } from "../components/AlertCardExpanded";
import { EvidencePanel } from "../components/EvidencePanel";
import { RemediationPanel } from "../components/RemediationPanel";
import { RelatedAlertsPanel } from "../components/RelatedAlertsPanel";

/**
 * アラート詳細ページ（DefaultLayout＝デモUI非侵食）。
 * /alerts/:id の単一取得 → ヘッダ＋AlertCardExpanded を再利用して全文表示する。
 */
export function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const http = useMemo(() => new FetchHttpClient(), []);
  const api = useMemo(() => createAlertsApi(http), [http]);
  const evidenceApi = useMemo(() => createEvidenceApi(http), [http]);
  const remediationApi = useMemo(() => createRemediationApi(http), [http]);
  const stream = useMemo(() => new SSEAlertStream(), []);
  const { alert, status, error, refresh } = useAlert(api, id, stream);

  const handleDecision = useCallback(
    async (alertId: string, decision: FeedbackDecision, operatorNote?: string) => {
      try {
        await submitFeedback(api, { alertId, decision, operatorNote });
        await refresh();
      } catch (e) {
        console.error("feedback submission failed", e);
      }
    },
    [api, refresh],
  );

  const handleReinvestigate = useCallback(
    async (alertId: string, operatorNote: string) => {
      try {
        await reinvestigate(api, { alertId, operatorNote });
        // 202 直後に ANALYZING（再調査中）を反映。確定は SSE（useAlert に stream 注入済み）で届く。
        await refresh();
      } catch (e) {
        console.error("reinvestigation request failed", e);
      }
    },
    [api, refresh],
  );

  return (
    <DefaultLayout>
      <Link
        to="/alerts"
        className="inline-block text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← 一覧へ
      </Link>

      <div className="mt-4">
        {status === "loading" && (
          <div className="h-40 animate-pulse rounded-tremor-default bg-slate-800/40" />
        )}

        {status === "error" && (
          <div className="rounded-tremor-default bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
            アラートの取得に失敗しました。{error?.message}
          </div>
        )}

        {status === "ready" && alert && (
          <article className="space-y-4">
            <header className="space-y-2">
              <div className="flex items-center gap-2">
                <SeverityBadge level={alert.severity} />
                <span className="rounded bg-slate-700/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
                  {alert.category}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-slate-100">
                {alert.eventName}
              </h2>
              <p className="text-xs text-slate-500">{alert.source}</p>
            </header>

            <AlertCardExpanded
              alert={alert}
              onDecision={handleDecision}
              onReinvestigate={handleReinvestigate}
            />
            <RelatedAlertsPanel alert={alert} />
            <RemediationPanel alert={alert} api={remediationApi} />
            {hasAiInvestigation(alert) && (
              <EvidencePanel api={evidenceApi} alert={alert} />
            )}
          </article>
        )}
      </div>
    </DefaultLayout>
  );
}

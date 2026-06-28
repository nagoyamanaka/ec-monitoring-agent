import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { hasAiInvestigation } from "../domain/AlertView";
import { useAlertsData } from "../presentation/AlertsDataProvider";
import {
  submitFeedback,
  type FeedbackDecision,
} from "../application/submitFeedback";
import { reinvestigate } from "../application/reinvestigate";
import { AlertCardExpanded } from "../components/AlertCardExpanded";
import { EvidencePanel } from "../components/EvidencePanel";
import { RemediationPanel } from "../components/RemediationPanel";
import { RelatedAlertsPanel } from "../components/RelatedAlertsPanel";
import { StreamStatusIndicator } from "../components/StreamStatusIndicator";

/**
 * アラート詳細ページ（DefaultLayout＝デモUI非侵食・ディープリンク/別タブ用）。
 * 一覧 state は AlertsDataProvider が保持しているため、ここでは再 fetch せず共有 alerts から
 * id で引く＝即表示＋SSE ライブ反映（ANALYZING→OPEN・証拠 done 判定・リメディ確定が追従）。
 */
export function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // 「戻る」＝直前の画面（一覧のドロワー位置・前の詳細）へ。一覧へのジャンプは header の
  // 「ALERT」が担うため重複させない。直リンク/別タブで履歴が無いときだけ /alerts へ退避。
  const handleBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/alerts");
  }, [navigate]);
  const {
    alerts,
    status: listStatus,
    error,
    streamStatus,
    lastUpdatedAt,
    refreshAlert,
    reconnectStream,
    remediationByAlertId,
    api,
    evidenceApi,
    remediationApi,
  } = useAlertsData();

  const alert = id ? alerts.find((a) => a.id === id) ?? null : null;
  // 一覧が ready なのに見つからない＝存在しない id（404 相当）。読み込み中はローディング。
  const status =
    listStatus === "ready" ? (alert ? "ready" : "notfound") : listStatus;

  const handleDecision = useCallback(
    async (alertId: string, decision: FeedbackDecision, operatorNote?: string) => {
      try {
        await submitFeedback(api, { alertId, decision, operatorNote });
        await refreshAlert(alertId);
      } catch (e) {
        console.error("feedback submission failed", e);
      }
    },
    [api, refreshAlert],
  );

  const handleReinvestigate = useCallback(
    async (alertId: string, operatorNote: string) => {
      try {
        await reinvestigate(api, { alertId, operatorNote });
        // 202 直後に ANALYZING（再調査中）を反映。確定は共有 SSE で一覧→本ページに届く。
        await refreshAlert(alertId);
      } catch (e) {
        console.error("reinvestigation request failed", e);
      }
    },
    [api, refreshAlert],
  );

  return (
    <DefaultLayout
      headerSlot={
        <StreamStatusIndicator
          status={streamStatus}
          lastUpdatedAt={lastUpdatedAt}
          onReconnect={reconnectStream}
        />
      }
    >
      <button
        type="button"
        onClick={handleBack}
        className="inline-block text-sm text-slate-400 transition hover:text-slate-200"
      >
        ← 戻る
      </button>

      <div className="mt-4">
        {status === "loading" && (
          <div className="h-40 animate-pulse rounded-tremor-default bg-slate-800/40" />
        )}

        {status === "error" && (
          <div className="rounded-tremor-default bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
            アラートの取得に失敗しました。{error?.message}
          </div>
        )}

        {status === "notfound" && (
          <div className="rounded-tremor-default bg-slate-800/30 px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-inset ring-slate-700/50">
            指定されたアラートは見つかりませんでした。
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
            <RelatedAlertsPanel
              alert={alert}
              lookup={(rid) => alerts.find((a) => a.id === rid)}
            />
            <RemediationPanel
              alert={alert}
              api={remediationApi}
              pushed={remediationByAlertId.get(alert.id) ?? null}
              live
            />
            {hasAiInvestigation(alert) && (
              <EvidencePanel api={evidenceApi} alert={alert} />
            )}
          </article>
        )}
      </div>
    </DefaultLayout>
  );
}

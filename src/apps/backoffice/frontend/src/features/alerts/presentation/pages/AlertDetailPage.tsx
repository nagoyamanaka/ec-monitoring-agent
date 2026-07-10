import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DefaultLayout } from "@shared/layouts/DefaultLayout";
import { useForecastNav } from "@features/forecast/presentation/ForecastProvider";
import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { LinkIcon } from "@shared/ui/icons";
import { hasAiInvestigation } from "../../domain/AlertView";
import { eventTitle } from "../../domain/eventCatalog";
import { useAlertsData } from "../AlertsDataProvider";
import {
  submitFeedback,
  type FeedbackDecision,
} from "../../application/submitFeedback";
import { reinvestigate } from "../../application/reinvestigate";
import { useAlertDetail } from "../hooks/useAlertDetail";
import { AlertCardExpanded } from "../components/AlertCardExpanded";
import { AlertReviewPanel } from "../components/AlertReviewPanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { FallbackRecoveryBanner } from "../components/FallbackRecoveryBanner";
import { InvestigationPipelinePanel } from "../components/InvestigationPipelinePanel";
import { RemediationPanel } from "../components/RemediationPanel";
import { RelatedAlertsPanel } from "../components/RelatedAlertsPanel";
import { LiveStreamStatus } from "../components/LiveStreamStatus";
import { formatDateTimeJa } from "@shared/format/dateTime";

/** 報告書の各ブロックをカードで括る共通スタイル（グルーピングで視線の止め所を作る）。 */
const PANEL = "rounded-lg bg-slate-800/40 p-5";

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
    refreshAlert,
    remediationByAlertId,
    investigationProgressByAlertId,
    api,
    evidenceApi,
    remediationApi,
  } = useAlertsData();

  // Forecast タブの表示可否＋HIGH バッジ（FORECAST_ENABLED off なら非表示・F7）。
  const forecastNav = useForecastNav();

  // 現役（一覧＝SSE ライブ）とアーカイブ（RESOLVED＝GET /alerts/:id 単品）の二源を隠し、
  // この1件を単一インターフェースで得る。refresh は源に合わせて再取得する（useAlertDetail 参照）。
  const {
    alert,
    status,
    refresh: refreshCurrent,
  } = useAlertDetail({ id, alerts, listStatus, refreshAlert, api });

  const handleDecision = useCallback(
    async (alertId: string, decision: FeedbackDecision, operatorNote?: string) => {
      try {
        await submitFeedback(api, { alertId, decision, operatorNote });
        await refreshCurrent(alertId);
      } catch (e) {
        console.error("feedback submission failed", e);
      }
    },
    [api, refreshCurrent],
  );

  const handleReinvestigate = useCallback(
    async (alertId: string, operatorNote: string) => {
      try {
        await reinvestigate(api, { alertId, operatorNote });
        // 202 直後に ANALYZING（再調査中）を反映。確定は共有 SSE で一覧→本ページに届く。
        await refreshCurrent(alertId);
      } catch (e) {
        console.error("reinvestigation request failed", e);
      }
    },
    [api, refreshCurrent],
  );

  // 既知一致のオンデマンド AI 調査（202／レポート添付は SSE で届く）。
  const handleGenerateReport = useCallback(
    async (alertId: string) => {
      try {
        await api.requestReport(alertId);
      } catch (e) {
        console.error("report request failed", e);
      }
    },
    [api],
  );

  // 手動即時昇格（結晶化）。
  const handlePromote = useCallback(
    async (alertId: string) => {
      try {
        await api.promote(alertId);
        await refreshCurrent(alertId);
      } catch (e) {
        console.error("promote request failed", e);
      }
    },
    [api, refreshCurrent],
  );

  // 報告書の共有はダウンロード（静的スナップショット＝引用リンクが死ぬ）より、生きた証跡を
  // たどれるディープリンクのコピーを優先する。
  const [copied, setCopied] = useState(false);
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("copy link failed", e);
    }
  }, []);

  return (
    <DefaultLayout
      forecastEnabled={forecastNav.enabled}
      forecastBadge={forecastNav.badge}
      headerSlot={<LiveStreamStatus />}
    >
      <button
        type="button"
        onClick={handleBack}
        className="inline-block text-sm text-slate-300 transition hover:text-slate-200"
      >
        ← 戻る
      </button>

      <div className="mt-4">
        {status === "loading" && (
          <div className="h-40 animate-pulse rounded-tremor-default bg-slate-800/40" />
        )}

        {status === "error" && (
          <div className="rounded-tremor-default bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            アラートの取得に失敗しました。{error?.message}
          </div>
        )}

        {status === "notfound" && (
          <div className="rounded-tremor-default bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-400">
            指定されたアラートは見つかりませんでした。
          </div>
        )}

        {status === "ready" && alert && (
          <article className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <SeverityBadge level={alert.severity} />
                  <span className="rounded-md bg-slate-700/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-300">
                    {alert.category}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-50">
                  {eventTitle(alert.eventName)}
                </h2>
                <p className="text-xs text-slate-400">
                  <code>{alert.eventName}</code> · {alert.source} ·{" "}
                  {formatDateTimeJa(alert.occurredOn)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-inset ring-slate-700/60 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {copied ? (
                  "✓ コピーしました"
                ) : (
                  <>
                    <LinkIcon className="shrink-0" />
                    リンクをコピー
                  </>
                )}
              </button>
            </header>

            {/* AI 調査失敗（fallback）の警告＋ワンクリック再調査（タスク E3）。
                再調査中（ANALYZING）は下のパイプラインビューが進行を示すため出さない。 */}
            {alert.report?.isFallback && alert.status !== "ANALYZING" && (
              <FallbackRecoveryBanner
                alert={alert}
                onReinvestigate={handleReinvestigate}
              />
            )}
            {/* AI 調査ライブ・タイムライン（E1）。ANALYZING 告知はここに一本化し、
                完了タイムラインは full 射影の「調査ステップ」と重複するため出さない。 */}
            <InvestigationPipelinePanel
              key={alert.id}
              alert={alert}
              progress={investigationProgressByAlertId.get(alert.id) ?? []}
              showCompletionTimeline={false}
            />
            <AlertCardExpanded
              alert={alert}
              variant="full"
              analyzingNotice={false}
              className={PANEL}
            />
            <RelatedAlertsPanel
              alert={alert}
              lookup={(rid) => alerts.find((a) => a.id === rid)}
              alerts={alerts}
              className={PANEL}
            />
            {/* 自動修正は実際の修正対象（payload.vulnerabilities）を持つ SECURITY 検知のみ。 */}
            {alert.category === "SECURITY" && (
              <RemediationPanel
                alert={alert}
                api={remediationApi}
                pushed={remediationByAlertId.get(alert.id) ?? null}
                live
                className={PANEL}
              />
            )}
            {hasAiInvestigation(alert) && (
              <EvidencePanel api={evidenceApi} alert={alert} className={PANEL} />
            )}
            {/* 判定は報告書の締めアクションとして末尾に置く（一覧ドロワーと配置統一）。 */}
            <AlertReviewPanel
              alert={alert}
              onDecision={handleDecision}
              onReinvestigate={handleReinvestigate}
              onGenerateReport={handleGenerateReport}
              onPromote={handlePromote}
            />
          </article>
        )}
      </div>
    </DefaultLayout>
  );
}

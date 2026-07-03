import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ConfidenceGauge } from "@shared/ui/tremor";
import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { formatDateTimeJa, formatTimeJa } from "@shared/format/dateTime";
import {
  type AlertView,
  isAnalyzing,
  hasAiInvestigation,
} from "../../domain/AlertView";
import { alertConfidence } from "../../domain/alertConfidence";
import { reportTeaser } from "../../domain/reportTeaser";
import { eventInfo, eventTitle } from "../../domain/eventCatalog";
import { categoryInfo } from "../../domain/alertCategory";
import type { InvestigationProgressView } from "../../domain/investigationProgress";
import type { FeedbackDecision } from "../../application/submitFeedback";
import type { EvidenceApi } from "../../infrastructure/evidenceApi";
import type { RemediationApi } from "../../infrastructure/remediationApi";
import type { RemediationView } from "../../domain/RemediationView";
import { AlertCardExpanded } from "./AlertCardExpanded";
import { AlertReviewPanel } from "./AlertReviewPanel";
import { AlertStatusBadge } from "./AlertStatusBadge";
import { EvidencePanel } from "./EvidencePanel";
import { InvestigationPipelinePanel } from "./InvestigationPipelinePanel";
import { RemediationPanel } from "./RemediationPanel";
import { RelatedAlertsPanel } from "./RelatedAlertsPanel";
import { ExactMatchBadge } from "./ExactMatchBadge";

export interface AlertDetailDrawerProps {
  /** 表示対象。null なら閉（何も描画しない）。 */
  alert: AlertView | null;
  onClose: () => void;
  /**
   * 関連アラートを辿った先で「← 前のアラートに戻る」を出す（任意）。
   * 渡された場合のみボタンを描画する＝探索履歴があるときだけ戻れる。
   */
  onBack?: () => void;
  onDecision?: (
    alertId: string,
    decision: FeedbackDecision,
    operatorNote?: string,
  ) => void | Promise<void>;
  /** 「却下して AI 再調査」。人間の指摘を AI に返して再調査させる。 */
  onReinvestigate?: (
    alertId: string,
    operatorNote: string,
  ) => void | Promise<void>;
  /** 既知一致 Alert のオンデマンド AI レポート生成。 */
  onGenerateReport?: (alertId: string) => void | Promise<void>;
  /** 未知 Alert の手動即時昇格（結晶化）。 */
  onPromote?: (alertId: string) => void | Promise<void>;
  /** 渡された場合のみ証拠パネルを表示する（composition root で注入）。 */
  evidenceApi?: EvidenceApi;
  /** 渡された場合のみリメディエーションパネルを表示する（composition root で注入）。 */
  remediationApi?: RemediationApi;
  /** SSE で届いた選択中アラートのリメディ確定（live 反映用）。 */
  pushedRemediation?: RemediationView | null;
  /** SSE で届いた選択中アラートの調査進行イベント（調査パイプラインビュー・E1 のライブ表示用）。 */
  investigationProgress?: readonly InvestigationProgressView[];
  /** 関連アラートの alertId → AlertView 解決（一覧から渡す。関連の日時/severity 補完用）。 */
  relatedLookup?: (id: string) => AlertView | undefined;
  /** 一覧のアラート集合。完全一致分類の「過去の同型事例」（同 eventName の対処済み）を引くのに使う。 */
  alerts?: readonly AlertView[];
  /**
   * 関連アラートを開く（任意）。渡されると関連行はルート遷移せず本ハンドラで選択を差し替える
   * ＝デモの舞台（/alerts）に留まったまま探索でき、戻るで前のドロワーに復元できる。
   * 無い場合（詳細ページ等）は従来どおり `/alerts/:id` への `Link` にフォールバックする。
   */
  onRelatedNavigate?: (id: string) => void;
}

/**
 * 重複観測の期間サマリ。occurrenceCount ≥ 2 のときのみ表示する。
 * createdAt（初回）〜 updatedAt（最新）のスパンを「N分間」「N時間」等に丸める。
 */
function formatOccurrenceSummary(alert: {
  occurrenceCount: number;
  createdAt: string;
  updatedAt: string;
}): string | null {
  if (alert.occurrenceCount < 2) return null;
  const first = new Date(alert.createdAt);
  const last = new Date(alert.updatedAt);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return null;

  const spanMs = last.getTime() - first.getTime();
  let span: string;
  if (spanMs < 60_000) {
    span = `${Math.round(spanMs / 1000)} 秒間`;
  } else if (spanMs < 3_600_000) {
    span = `${Math.round(spanMs / 60_000)} 分間`;
  } else {
    span = `${Math.round(spanMs / 3_600_000)} 時間`;
  }

  return `${span}に ${alert.occurrenceCount} 回観測（初回 ${formatTimeJa(first)} → 最新 ${formatTimeJa(last)}）`;
}

/**
 * アラート詳細の右オーバーレイ・ドロワー（master-detail の detail）。
 * 背景 dim ＋ Esc / バックドロップ / ✕ で閉じる。大きい confidence ゲージはここに置き、
 * 本体は AlertCardExpanded を要約射影（variant="summary"）で再利用する＝トリアージ用の原因候補＋
 * 障害規模(impact.scale)＋承認/却下に絞り、報告用フル（調査ステップ全文・impact 全項目・escalation・
 * review）は詳細ページ（AlertDetailPage・variant="full"）に委ねる（タスク37：射影違いで出し分け）。
 * 親は alerts.find(id) で最新 view を渡す＝SSE 更新がドロワーにもライブ反映される。
 */
export function AlertDetailDrawer({
  alert,
  onClose,
  onBack,
  onDecision,
  onReinvestigate,
  onGenerateReport,
  onPromote,
  evidenceApi,
  remediationApi,
  pushedRemediation,
  investigationProgress,
  relatedLookup,
  alerts,
  onRelatedNavigate,
}: AlertDetailDrawerProps) {
  useEffect(() => {
    if (!alert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alert, onClose]);

  if (!alert) return null;

  const confidence = alertConfidence(alert);
  const analyzing = isAnalyzing(alert);
  // AI 調査が失敗した fallback レポートは confidence が当てにならない＝ゲージを出さず警告だけ出す。
  const aiFallback = confidence.kind === "ai" && alert.report?.isFallback;
  const info = eventInfo(alert.eventName);
  const title = eventTitle(alert.eventName);
  const category = categoryInfo(alert.category);
  const occurrenceSummary = formatOccurrenceSummary(alert);
  // 詳細ページ限定コンテンツのティザー（タスク D5）。無ければ素のリンクにフォールバック。
  const teaser = reportTeaser(alert.report);

  return (
    <div
      className="fixed inset-0 z-30"
      role="dialog"
      aria-modal="true"
      aria-label="アラート詳細"
    >
      <div
        className="drawer-overlay absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* 狭幅（〜480px）ではビューポート幅いっぱいに畳む（E7: モバイル閲覧の最低保証）。 */}
      <aside className="drawer-panel absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l border-slate-700/60 bg-[#0B0E14] shadow-2xl">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 border-b border-slate-700/60 px-5 py-2 text-left text-xs font-medium text-cyan-300 transition hover:bg-slate-800/50 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
          >
            <span aria-hidden>←</span> 前のアラートに戻る
          </button>
        )}
        <header className="flex items-start gap-3 border-b border-slate-700/60 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {analyzing ? (
                <span className="inline-flex items-center rounded-full bg-slate-600/20 px-2.5 py-0.5 text-xs font-semibold text-slate-300 ring-1 ring-inset ring-slate-500/30">
                  重要度 判定中
                </span>
              ) : (
                <SeverityBadge level={alert.severity} />
              )}
              <span
                className="whitespace-nowrap rounded bg-slate-700/40 px-2 py-0.5 text-xs font-medium text-slate-300"
                title={category.description}
              >
                {category.label}
              </span>
              <AlertStatusBadge alert={alert} />
            </div>
            <h2 className="truncate text-lg font-semibold text-slate-50">
              {title}
            </h2>
            {info && (
              <p className="text-sm leading-relaxed text-slate-300">
                {info.description}
              </p>
            )}
            <p className="text-sm text-slate-300">
              {info && (
                <>
                  <code className="text-slate-300">{alert.eventName}</code>{" "}
                  ·{" "}
                </>
              )}
              {alert.source} · {formatDateTimeJa(alert.occurredOn)}
            </p>
            {occurrenceSummary && (
              <p className="text-xs text-amber-300/80">
                {occurrenceSummary}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 rounded-md px-2 py-1 text-slate-300 transition hover:bg-slate-800/60 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {confidence.kind === "exact-match" ? (
            <ExactMatchBadge variant="panel" />
          ) : confidence.kind === "ai" && aiFallback ? (
            <div className="rounded-tremor-default bg-amber-500/10 px-4 py-3 text-amber-200 ring-1 ring-inset ring-amber-500/25">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden>⚠</span>
                AI 調査に失敗・暫定表示
              </p>
              <p className="mt-1 text-xs text-amber-200/80">
                確信度は参考値です（再調査をおすすめします）
              </p>
            </div>
          ) : confidence.kind === "ai" ? (
            <div className="flex justify-center">
              <ConfidenceGauge
                confidence={confidence.value}
                size="lg"
                label="AI 確信度"
                color="cyan"
                animate
              />
            </div>
          ) : confidence.kind === "known" ? (
            <div className="flex justify-center">
              <ConfidenceGauge
                confidence={confidence.value}
                size="lg"
                label="既知事例との類似度"
                color="emerald"
                animate
              />
            </div>
          ) : null}
          {/* AI 調査ライブ・タイムライン（E1）: ANALYZING 中はパイプライン、完了直後はステップの
              順次アニメ。ANALYZING 告知は本パネルに一本化（AlertCardExpanded 側は抑止）。 */}
          <InvestigationPipelinePanel
            key={alert.id}
            alert={alert}
            progress={investigationProgress}
          />
          <AlertCardExpanded
            alert={alert}
            variant="summary"
            analyzingNotice={false}
          />
          <RelatedAlertsPanel
            alert={alert}
            lookup={relatedLookup}
            alerts={alerts}
            onNavigate={onRelatedNavigate}
          />
          {/* 自動修正（コード上の CVE 修正 PR）は payload.vulnerabilities を持つ SECURITY 検知だけが
              実際の修正対象を持つ。他カテゴリは AI が remediable=true と言っても実行は skip（対象なし）に
              なりノイズなので、パネル自体を SECURITY に限定して出す。 */}
          {remediationApi && alert.category === "SECURITY" && (
            <RemediationPanel
              alert={alert}
              api={remediationApi}
              pushed={pushedRemediation}
              live
            />
          )}
          {/* 分析中の証拠プレースホルダはパイプラインビュー（上）が代替するため完了後のみ出す。 */}
          {evidenceApi && hasAiInvestigation(alert) && !analyzing && (
            <EvidencePanel api={evidenceApi} alert={alert} />
          )}
          {/* 判定は末尾に統一配置（詳細ページと同じ）。 */}
          <AlertReviewPanel
            alert={alert}
            onDecision={onDecision}
            onReinvestigate={onReinvestigate}
            onGenerateReport={onGenerateReport}
            onPromote={onPromote}
          />
        </div>

        <footer className="border-t border-slate-700/60 px-5 py-3">
          {/* ティザーCTA（タスク D5）: 「詳細ページに行くと何が読めるか」を実データで予告する。
              full 射影(タスク37)限定のセクションをチップで棚卸しし、推奨アクション先頭1件を
              抜粋＝テキストリンクだけの空手形をなくしてクリック価値を事前に伝える。 */}
          {teaser ? (
            <Link
              to={`/alerts/${encodeURIComponent(alert.id)}`}
              className="group block rounded-lg bg-slate-800/40 px-4 py-3 ring-1 ring-inset ring-slate-700/60 transition hover:bg-slate-800/70 hover:ring-cyan-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                AI レポート全文
              </p>
              {teaser.headline && (
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-200">
                  <span aria-hidden className="text-cyan-300">
                    ▸{" "}
                  </span>
                  {teaser.headline}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {teaser.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[11px] font-medium text-slate-300 ring-1 ring-inset ring-slate-600/50"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-right text-xs font-medium text-cyan-300 transition group-hover:text-cyan-200">
                詳細ページで全文を読む →
              </p>
            </Link>
          ) : (
            <Link
              to={`/alerts/${encodeURIComponent(alert.id)}`}
              className="text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
            >
              詳細ページを開く →
            </Link>
          )}
        </footer>
      </aside>
    </div>
  );
}

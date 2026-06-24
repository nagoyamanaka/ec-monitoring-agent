import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ConfidenceGauge } from "@shared/ui/tremor";
import { SeverityBadge } from "@shared/ui/SeverityBadge";
import { type AlertView, isAnalyzing } from "../domain/AlertView";
import { alertConfidence } from "../domain/alertConfidence";
import { eventInfo, eventTitle } from "../domain/eventCatalog";
import { categoryInfo } from "../domain/alertCategory";
import type { FeedbackDecision } from "../application/submitFeedback";
import type { EvidenceApi } from "../infrastructure/evidenceApi";
import { AlertCardExpanded } from "./AlertCardExpanded";
import { AlertStatusBadge } from "./AlertStatusBadge";
import { EvidencePanel } from "./EvidencePanel";
import { ExactMatchBadge } from "./ExactMatchBadge";

export interface AlertDetailDrawerProps {
  /** 表示対象。null なら閉（何も描画しない）。 */
  alert: AlertView | null;
  onClose: () => void;
  onDecision?: (
    alertId: string,
    decision: FeedbackDecision,
  ) => void | Promise<void>;
  /** 渡された場合のみ証拠パネルを表示する（composition root で注入）。 */
  evidenceApi?: EvidenceApi;
}

function formatAbsoluteTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * アラート詳細の右オーバーレイ・ドロワー（master-detail の detail）。
 * 背景 dim ＋ Esc / バックドロップ / ✕ で閉じる。大きい confidence ゲージはここに置き、
 * 本体は AlertCardExpanded を再利用する（summary・調査ステップ・推奨アクション・承認/却下）。
 * 親は alerts.find(id) で最新 view を渡す＝SSE 更新がドロワーにもライブ反映される。
 */
export function AlertDetailDrawer({
  alert,
  onClose,
  onDecision,
  evidenceApi,
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

  return (
    <div
      className="fixed inset-0 z-30"
      role="dialog"
      aria-modal="true"
      aria-label="アラート詳細"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="absolute inset-y-0 right-0 flex w-[clamp(360px,38vw,480px)] flex-col border-l border-slate-700/60 bg-[#0B0E14] shadow-2xl">
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
                className="rounded bg-slate-700/40 px-2 py-0.5 text-xs font-medium text-slate-300"
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
            <p className="text-sm text-slate-400">
              {info && (
                <>
                  <code className="text-slate-400">{alert.eventName}</code>{" "}
                  ·{" "}
                </>
              )}
              {alert.source} · {formatAbsoluteTime(alert.occurredOn)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="shrink-0 rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
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
              />
            </div>
          ) : confidence.kind === "known" ? (
            <div className="flex justify-center">
              <ConfidenceGauge
                confidence={confidence.value}
                size="lg"
                label="既知事例との類似度"
                color="emerald"
              />
            </div>
          ) : null}
          <AlertCardExpanded alert={alert} onDecision={onDecision} />
          {evidenceApi && (
            <EvidencePanel api={evidenceApi} alertId={alert.id} />
          )}
        </div>

        <footer className="border-t border-slate-700/60 px-5 py-3">
          <Link
            to={`/alerts/${encodeURIComponent(alert.id)}`}
            className="text-xs text-cyan-300 transition hover:text-cyan-200"
          >
            詳細ページを開く →
          </Link>
        </footer>
      </aside>
    </div>
  );
}

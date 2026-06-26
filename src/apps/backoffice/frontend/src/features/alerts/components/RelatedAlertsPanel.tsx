import { Link } from "react-router-dom";
import { cn } from "@shared/ui/cn";
import { SeverityBadge } from "@shared/ui/SeverityBadge";
import type { AlertView } from "../domain/AlertView";
import { eventTitle } from "../domain/eventCatalog";
import {
  collectRelatedRefs,
  toRelatedAlertViews,
  type RelatedAlertView,
} from "../domain/relatedAlerts";

export interface RelatedAlertsPanelProps {
  /** 表示対象アラート。AI 相関（report.relatedAlerts）＋ SIMILARITY back-link を集約する。 */
  alert: AlertView;
  /**
   * alertId → 一覧の AlertView 解決関数（任意）。
   * 渡されると関連先の日時/severity/タイトルを補完する。無い・未解決でもリンクは出す。
   */
  lookup?: (id: string) => AlertView | undefined;
  className?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function RelatedAlertRow({ related }: { related: RelatedAlertView }) {
  const title = related.resolved && related.title ? eventTitle(related.title) : null;
  return (
    <Link
      to={`/alerts/${encodeURIComponent(related.alertId)}`}
      className="block rounded-md border border-slate-700/60 bg-slate-800/30 px-3 py-2.5 transition hover:border-cyan-500/40 hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
          {related.relationLabel}
        </span>
        {related.resolved && related.severity && (
          <SeverityBadge level={related.severity} />
        )}
        {related.resolved && related.occurredOn && (
          <span className="ml-auto text-[11px] text-slate-500">
            {formatTime(related.occurredOn)}
          </span>
        )}
      </div>
      {title && (
        <p className="mt-1.5 truncate text-sm font-medium text-slate-100">
          {title}
        </p>
      )}
      <p className="mt-1 text-xs leading-snug text-slate-400">
        {related.rationale}
      </p>
      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-cyan-300">
        <span aria-hidden>🔗</span>
        詳細を開く
      </span>
    </Link>
  );
}

/**
 * 関連アラート（タスク9e）。AI 調査が見つけた相関＋類似既知の back-link を1か所に束ね、
 * `/alerts/:id` への詳細導線を出す。関連が無ければ何も描画しない。
 */
export function RelatedAlertsPanel({
  alert,
  lookup,
  className,
}: RelatedAlertsPanelProps) {
  const refs = collectRelatedRefs(alert);
  if (refs.length === 0) return null;

  const related = toRelatedAlertViews(refs, lookup ?? (() => undefined));

  return (
    <section className={cn("space-y-2", className)} aria-label="関連アラート">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          関連アラート
        </h4>
        <span className="rounded-full bg-slate-700/40 px-1.5 text-[10px] font-medium text-slate-400">
          {related.length}
        </span>
      </div>
      <p className="text-[11px] text-slate-500">
        AI 調査が見つけた、根本原因や波及を共有する別アラートです。
      </p>
      <div className="space-y-2">
        {related.map((r) => (
          <RelatedAlertRow key={r.alertId} related={r} />
        ))}
      </div>
    </section>
  );
}

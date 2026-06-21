import { useState } from "react";
import { Card } from "@shared/ui/tremor";
import { cn } from "@shared/ui/cn";
import { type AlertView, isAnalyzing } from "../domain/AlertView";
import {
  isReviewed,
  type ReviewStatus,
} from "../domain/InvestigationReportView";
import type { FeedbackDecision } from "../application/submitFeedback";

export interface AlertCardExpandedProps {
  alert: AlertView;
  /** 承認/却下。await できる場合は送信中ボタンを無効化する。 */
  onDecision?: (
    alertId: string,
    decision: FeedbackDecision,
  ) => void | Promise<void>;
  className?: string;
}

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  PENDING_REVIEW: "レビュー待ち",
  APPROVED: "承認済み",
  REJECTED: "却下済み",
};

/**
 * Alert の展開ビュー（カード内インライン／詳細ページ本体で共用）。
 * サマリ・調査ステップ・推奨アクション・[✓承認][✗却下] を表示する。
 * レポート未到着（分析中/未調査）はプレースホルダを出す。
 */
export function AlertCardExpanded({
  alert,
  onDecision,
  className,
}: AlertCardExpandedProps) {
  const [submitting, setSubmitting] = useState<FeedbackDecision | null>(null);
  const report = alert.report;

  const decide = async (decision: FeedbackDecision) => {
    if (submitting || !onDecision) return;
    setSubmitting(decision);
    try {
      await onDecision(alert.id, decision);
    } finally {
      setSubmitting(null);
    }
  };

  if (!report) {
    return (
      <div className={cn("text-sm text-slate-400", className)}>
        {isAnalyzing(alert)
          ? "AI が未知障害を調査中です…"
          : "調査レポートはまだありません。"}
      </div>
    );
  }

  const reviewed = isReviewed(report.reviewStatus);

  return (
    <div className={cn("space-y-4 text-sm text-slate-300", className)}>
      <p className="leading-relaxed text-slate-200">{report.summary}</p>

      {report.investigationSteps.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            調査ステップ
          </h4>
          <ol className="list-decimal space-y-1 pl-5 marker:text-slate-500">
            {report.investigationSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      {report.suggestedActions.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            推奨アクション
          </h4>
          <ul className="list-disc space-y-1 pl-5 marker:text-cyan-500/70">
            {report.suggestedActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </section>
      )}

      <Card className="flex items-center justify-between gap-3 !bg-slate-800/40 !p-3 !ring-slate-700/60">
        <span className="text-xs text-slate-400">
          推定パターン: <span className="text-slate-200">{report.suggestedPatternName}</span>
        </span>
        {reviewed ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              report.reviewStatus === "APPROVED"
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-rose-500/15 text-rose-300",
            )}
          >
            {REVIEW_LABEL[report.reviewStatus]}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => decide("approve")}
              className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {submitting === "approve" ? "送信中…" : "✓ 承認"}
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => decide("reject")}
              className="rounded-md bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-inset ring-rose-500/30 transition hover:bg-rose-500/25 disabled:opacity-50"
            >
              {submitting === "reject" ? "送信中…" : "✗ 却下"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

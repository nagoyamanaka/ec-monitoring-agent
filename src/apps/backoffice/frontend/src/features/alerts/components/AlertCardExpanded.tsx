import { useState } from "react";
import { Card } from "@shared/ui/tremor";
import { cn } from "@shared/ui/cn";
import { type AlertView } from "../domain/AlertView";
import { alertReason } from "../domain/alertReason";
import {
  alertReviewState,
  isAlertReviewed,
  type AlertReviewState,
} from "../domain/alertReview";
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

const REVIEW_LABEL: Record<AlertReviewState, string> = {
  PENDING: "レビュー待ち",
  APPROVED: "承認済み",
  REJECTED: "却下済み",
};

/** 一致条件の値を表示用に整形（文字列はそのまま、それ以外は JSON 表記）。 */
function formatValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Alert の展開ビュー（詳細ドロワー本体／詳細ページで共用）。
 * 既知パターン（classification の根拠）と AI 調査（summary/steps/actions）の両方を扱い、
 * 「何が・なぜ」を必ず提示する。承認/却下は feedback ベースで既知・未知を統一して扱う。
 */
export function AlertCardExpanded({
  alert,
  onDecision,
  className,
}: AlertCardExpandedProps) {
  const [submitting, setSubmitting] = useState<FeedbackDecision | null>(null);
  const report = alert.report;
  const reason = alertReason(alert);
  const known = alert.classification.type === "known";
  const reviewed = isAlertReviewed(alert);
  const reviewState = alertReviewState(alert);

  const decide = async (decision: FeedbackDecision) => {
    if (submitting || !onDecision) return;
    setSubmitting(decision);
    try {
      await onDecision(alert.id, decision);
    } finally {
      setSubmitting(null);
    }
  };

  // 分析中（既知でもなく調査レポートも無い）はプレースホルダ
  if (reason.kind === "analyzing" && !report && !known) {
    return (
      <div className={cn("text-sm text-slate-300", className)}>
        AI が未知障害を調査中です…
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 text-sm text-slate-200", className)}>
      {/* 推定原因（該当パターン / AI 推定パターン） */}
      {reason.kind !== "analyzing" && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            {known ? "該当パターン（既知）" : "AI 推定パターン"}
          </h4>
          <p className="text-slate-100">{reason.patternName}</p>
        </section>
      )}

      {/* 既知パターンの一致根拠（なぜそう判断したか） */}
      {alert.classification.type === "known" &&
        alert.classification.matchedConditions.length > 0 && (
          <section className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              一致した根拠
            </h4>
            <div className="overflow-x-auto rounded-md ring-1 ring-inset ring-slate-700/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400">
                    <th className="px-3 py-1.5 font-medium">項目</th>
                    <th className="px-3 py-1.5 font-medium">期待値</th>
                    <th className="px-3 py-1.5 font-medium">実値</th>
                  </tr>
                </thead>
                <tbody>
                  {alert.classification.matchedConditions.map((c, i) => (
                    <tr key={i} className="border-t border-slate-700/50">
                      <td className="px-3 py-1.5">
                        <code className="text-cyan-300">{c.field}</code>
                      </td>
                      <td className="px-3 py-1.5 text-slate-300">
                        {formatValue(c.expectedValue)}
                      </td>
                      <td className="px-3 py-1.5 text-slate-100">
                        {formatValue(c.actualValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {/* AI 調査レポート（未知パターン） */}
      {report && (
        <>
          <p className="leading-relaxed text-slate-100">{report.summary}</p>

          {report.investigationSteps.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
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
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  推奨アクション
                </h4>
                {/* AI が「コードで直せる」と判定した場合のみ提示。remediate 実行の判断材料。 */}
                {report.remediable && (
                  <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30">
                    コードで修正可能（AI 判定）
                  </span>
                )}
              </div>
              <ul className="list-disc space-y-1 pl-5 marker:text-cyan-500/70">
                {report.suggestedActions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* レビュー（承認/却下） */}
      <Card className="flex items-center justify-between gap-3 !bg-slate-800/40 !p-3 !ring-slate-700/60">
        {reviewed ? (
          <>
            <span className="text-xs text-slate-400">この分類の判定</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                reviewState === "APPROVED"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-rose-500/15 text-rose-300",
              )}
            >
              {REVIEW_LABEL[reviewState]}
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-slate-400">この分類は正しいですか？</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => decide("approve")}
                className="min-w-[5.5rem] rounded-md bg-emerald-500/15 px-3 py-1.5 text-center text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {submitting === "approve" ? "送信中…" : "✓ 承認"}
              </button>
              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => decide("reject")}
                className="min-w-[5.5rem] rounded-md bg-rose-500/15 px-3 py-1.5 text-center text-xs font-semibold text-rose-300 ring-1 ring-inset ring-rose-500/30 transition hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {submitting === "reject" ? "送信中…" : "✗ 却下"}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

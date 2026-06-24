import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@shared/ui/tremor";
import { cn } from "@shared/ui/cn";
import { type AlertView } from "../domain/AlertView";
import { InvestigationItem } from "./InvestigationItem";
import { alertReason } from "../domain/alertReason";
import { alertReviewState, isAlertReviewed } from "../domain/alertReview";
import type { FeedbackDecision } from "../application/submitFeedback";

export interface AlertCardExpandedProps {
  alert: AlertView;
  /**
   * 承認/却下（二値の学習シグナル）。却下時は理由/修正方針（operatorNote）を添える。
   * await できる場合は送信中ボタンを無効化する。
   */
  onDecision?: (
    alertId: string,
    decision: FeedbackDecision,
    operatorNote?: string,
  ) => void | Promise<void>;
  /**
   * 「却下して AI 再調査」。人間の指摘を AI に返して再調査させる（やり直し＝二値学習とは別経路）。
   * 渡されない場合は再調査ボタンを出さない。
   */
  onReinvestigate?: (
    alertId: string,
    operatorNote: string,
  ) => void | Promise<void>;
  className?: string;
}

/** レビュー操作の送信中状態。3 種それぞれで個別にスピナー/無効化する。 */
type ReviewAction = FeedbackDecision | "reinvestigate";

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
  onReinvestigate,
  className,
}: AlertCardExpandedProps) {
  const [submitting, setSubmitting] = useState<ReviewAction | null>(null);
  // 却下フロー：理由/修正方針の入力を開いているか・入力中の note。
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const report = alert.report;
  const reason = alertReason(alert);
  const known = alert.classification.type === "known";
  const reviewed = isAlertReviewed(alert);
  const reviewState = alertReviewState(alert);
  // 状態が ANALYZING に戻っている＝AI が（再）調査中。既存の内容を持つときは再調査の最中。
  const analyzingNow = alert.status === "ANALYZING";
  const trimmedNote = note.trim();

  const decide = async (decision: FeedbackDecision, operatorNote?: string) => {
    if (submitting || !onDecision) return;
    setSubmitting(decision);
    try {
      await onDecision(alert.id, decision, operatorNote);
      // 成功後は却下入力を畳む（再取得した feedback でトグルの選択状態が更新される）。
      setRejecting(false);
      setNote("");
    } finally {
      setSubmitting(null);
    }
  };

  const requestReinvestigation = async () => {
    if (submitting || !onReinvestigate || !trimmedNote) return;
    setSubmitting("reinvestigate");
    try {
      await onReinvestigate(alert.id, trimmedNote);
      setRejecting(false);
      setNote("");
    } finally {
      setSubmitting(null);
    }
  };

  const cancelReject = () => {
    if (submitting) return;
    setRejecting(false);
    setNote("");
  };

  // 分析中（既知でもなく調査レポートも無い＝初回調査）はプレースホルダ
  if (reason.kind === "analyzing" && !report && !known) {
    return (
      <div className={cn("text-sm text-slate-300", className)}>
        AI が未知障害を調査中です…
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 text-sm text-slate-200", className)}>
      {/* 再調査中（人間の指摘を反映して AI が再分析中）。既存内容は下に残したまま明示する。 */}
      {analyzingNow && (
        <div className="flex items-center gap-2 rounded-md bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 ring-1 ring-inset ring-cyan-500/30">
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-cyan-400"
            aria-hidden
          />
          AI が指摘を反映して再調査中です…
        </div>
      )}

      {/* 推定原因（該当パターン / AI 推定パターン） */}
      {reason.kind !== "analyzing" && (
        <section className="space-y-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            {known ? "該当パターン（既知）" : "AI 推定パターン"}
          </h4>
          <p className="text-slate-100">{reason.patternName}</p>
          {/* 類似既知（SIMILARITY）は元の解決済み Alert へ内部ディープリンク。
              「過去の同型障害をどう直したか」へ即移動できる動線。 */}
          {alert.classification.type === "known" &&
            alert.classification.source === "SIMILARITY" &&
            alert.classification.sourceAlertId && (
              <Link
                to={`/alerts/${encodeURIComponent(alert.classification.sourceAlertId)}`}
                className="inline-flex items-center gap-1 text-xs text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 transition hover:text-cyan-200 hover:decoration-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span aria-hidden>🔗</span>
                <span>過去の同型障害を見る</span>
              </Link>
            )}
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
                  <li key={i}>
                    <InvestigationItem item={step} />
                  </li>
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
                  <li key={i}>
                    <InvestigationItem item={action} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* レビュー（承認/却下／却下して再調査）。再調査中は操作を伏せて再分析を待つ。
          承認/却下は常時2つ並ぶセグメント・トグル＝現在の判定を選択状態で示し、
          反対側を押すと再決定できる（誤承認→却下・却下→承認）。選択中は押下不可。 */}
      {!analyzingNow &&
        (rejecting ? (
          <Card className="space-y-3 !bg-slate-800/40 !p-3 !ring-slate-700/60">
            <div className="space-y-1">
              <label
                htmlFor={`reject-note-${alert.id}`}
                className="text-xs font-semibold text-slate-300"
              >
                何が違うか・どう直すか（AI へ返す指摘）
              </label>
              <textarea
                id={`reject-note-${alert.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting !== null}
                rows={3}
                autoFocus
                placeholder="例: 原因は決済 API ではなく在庫サービス。タイムアウト閾値の見直しを提案して。"
                className="w-full resize-y rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-500/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting !== null}
                onClick={cancelReject}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={submitting !== null || trimmedNote === ""}
                onClick={() => decide("reject", trimmedNote)}
                className="min-w-[6rem] rounded-md bg-rose-500/15 px-3 py-1.5 text-center text-xs font-semibold text-rose-300 ring-1 ring-inset ring-rose-500/30 transition hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {submitting === "reject" ? "送信中…" : "却下する"}
              </button>
              {onReinvestigate && (
                <button
                  type="button"
                  disabled={submitting !== null || trimmedNote === ""}
                  onClick={requestReinvestigation}
                  className="min-w-[9rem] rounded-md bg-cyan-500/15 px-3 py-1.5 text-center text-xs font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30 transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                  {submitting === "reinvestigate"
                    ? "再調査を依頼中…"
                    : "却下して AI 再調査"}
                </button>
              )}
            </div>
          </Card>
        ) : (
          <Card className="space-y-2 !bg-slate-800/40 !p-3 !ring-slate-700/60">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                {reviewed ? "この分類の判定" : "この分類は正しいですか？"}
              </span>
              <div
                className="flex items-center gap-2"
                role="group"
                aria-label="分類の判定"
              >
                <button
                  type="button"
                  aria-pressed={reviewState === "APPROVED"}
                  disabled={submitting !== null || reviewState === "APPROVED"}
                  onClick={() => decide("approve")}
                  className={cn(
                    "min-w-[5.5rem] rounded-md px-3 py-1.5 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95 disabled:active:scale-100",
                    reviewState === "APPROVED"
                      ? "bg-emerald-500/25 text-emerald-200 ring-2 ring-inset ring-emerald-400/60 disabled:opacity-100"
                      : "bg-slate-800 text-slate-500 ring-1 ring-slate-700 hover:bg-slate-700",
                  )}
                >
                  {submitting === "approve"
                    ? "送信中…"
                    : reviewState === "APPROVED"
                      ? "✓ 承認済み"
                      : "✓ 承認"}
                </button>
                <button
                  type="button"
                  aria-pressed={reviewState === "REJECTED"}
                  disabled={submitting !== null || reviewState === "REJECTED"}
                  onClick={() => setRejecting(true)}
                  className={cn(
                    "min-w-[5.5rem] rounded-md px-3 py-1.5 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95 disabled:active:scale-100",
                    reviewState === "REJECTED"
                      ? "bg-rose-500/25 text-rose-200 ring-2 ring-inset ring-rose-400/60 disabled:opacity-100"
                      : "bg-slate-800 text-slate-500 ring-1 ring-slate-700 hover:bg-slate-700",
                  )}
                >
                  {reviewState === "REJECTED" ? "X 却下済み" : "X 却下"}
                </button>
              </div>
            </div>
            {reviewState === "REJECTED" && alert.feedback?.operatorNote && (
              <p className="text-[11px] leading-snug text-slate-400">
                却下理由：「{alert.feedback.operatorNote}」
              </p>
            )}
          </Card>
        ))}
    </div>
  );
}

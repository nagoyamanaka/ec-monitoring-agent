import { useState } from "react";
import { Card } from "@shared/ui/tremor";
import { cn } from "@shared/ui/cn";
import type { AlertView } from "../../domain/AlertView";
import { alertReviewState, isAlertReviewed } from "../../domain/alertReview";
import type { FeedbackDecision } from "../../application/submitFeedback";

export interface AlertReviewPanelProps {
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
  /**
   * 既知一致 Alert（AI 自動調査なしで即確定）に対する「今回paramでの AI レポートをオンデマンド生成」。
   * 渡されない、または既にレポートがある場合はボタンを出さない。
   */
  onGenerateReport?: (alertId: string) => void | Promise<void>;
  /**
   * 未知 Alert を「回数不問で既知パターンへ手動即時昇格（結晶化）」する。
   * 渡されない、または結晶化材料（非 fallback レポート）が無い場合はボタンを出さない。
   */
  onPromote?: (alertId: string) => void | Promise<void>;
  className?: string;
}

/** レビュー操作の送信中状態。各種それぞれで個別にスピナー/無効化する。 */
type ReviewAction =
  | FeedbackDecision
  | "reinvestigate"
  | "generate-report"
  | "promote";

/**
 * 分類レビュー（承認/却下／却下して AI 再調査）。報告書の締めアクションとして
 * 一覧ドロワー・詳細ページの末尾に共通配置する（AlertCardExpanded から分離・統一）。
 * 承認/却下は常時2つ並ぶセグメント・トグル＝現在の判定を選択状態で示し、反対側を押すと
 * 再決定できる（誤承認→却下・却下→承認）。選択中は押下不可。
 * 再調査中（ANALYZING）は判定を伏せて再分析を待つ＝何も描画しない。
 */
export function AlertReviewPanel({
  alert,
  onDecision,
  onReinvestigate,
  onGenerateReport,
  onPromote,
  className,
}: AlertReviewPanelProps) {
  const [submitting, setSubmitting] = useState<ReviewAction | null>(null);
  // 昇格の完了通知。昇格は Alert 本体を変えず SSE も出さない（パターン側の結晶化）ため、
  // フロントで「焼き付けた」ことを明示する。成功後トグルを success 表示に差し替える。
  const [promoted, setPromoted] = useState(false);
  // 却下フロー：理由/修正方針の入力を開いているか・入力中の note。
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const reviewed = isAlertReviewed(alert);
  const reviewState = alertReviewState(alert);
  const trimmedNote = note.trim();

  // 既知一致でレポート未着なら「オンデマンド生成」を出す（既知は AI を自動起動しないため）。
  const canGenerateReport =
    !!onGenerateReport &&
    alert.classification.type === "known" &&
    alert.report === null;
  // 未知で有効な調査レポートがあれば「既知へ昇格（結晶化）」を出す。
  const canPromote =
    !!onPromote &&
    alert.classification.type === "unknown" &&
    alert.report !== null &&
    !alert.report.isFallback;

  const generateReport = async () => {
    if (submitting || !onGenerateReport) return;
    setSubmitting("generate-report");
    try {
      await onGenerateReport(alert.id);
    } finally {
      setSubmitting(null);
    }
  };

  const promote = async () => {
    if (submitting || !onPromote) return;
    setSubmitting("promote");
    try {
      await onPromote(alert.id);
      setPromoted(true);
    } finally {
      setSubmitting(null);
    }
  };

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

  // 再調査中（人間の指摘を反映して AI が再分析中）は判定を伏せて待つ。
  if (alert.status === "ANALYZING") return null;

  if (rejecting) {
    return (
      <Card
        className={cn("space-y-3 !bg-slate-800/40 !p-3 !ring-slate-700/60", className)}
      >
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
            className="w-full resize-y rounded-md border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:border-cyan-500/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50 disabled:opacity-50"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={submitting !== null}
            onClick={cancelReject}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50"
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
    );
  }

  return (
    <Card
      className={cn("space-y-2 !bg-slate-800/40 !p-3 !ring-slate-700/60", className)}
    >
      {/* 間延び対策：両端寄せ（justify-between）をやめ、ラベル＋ボタンを左に詰める。 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-slate-300">
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
                : "bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:bg-slate-700",
            )}
          >
            {(() => {
              const label =
                submitting === "approve"
                  ? "送信中…"
                  : reviewState === "APPROVED"
                    ? "✓ 承認済み"
                    : "✓ 承認";
              // ラベルが変わるたびキーが変わり、ボタン→ステータス表記がフェード差し替わる。
              return (
                <span key={label} className="badge-fade-in inline-block">
                  {label}
                </span>
              );
            })()}
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
                : "bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:bg-slate-700",
            )}
          >
            {(() => {
              const label = reviewState === "REJECTED" ? "✗ 却下済み" : "✗ 却下";
              return (
                <span key={label} className="badge-fade-in inline-block">
                  {label}
                </span>
              );
            })()}
          </button>
        </div>
      </div>
      {(canGenerateReport || canPromote) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-700/40 pt-2">
          {canGenerateReport && (
            <button
              type="button"
              disabled={submitting !== null}
              onClick={generateReport}
              title="既知分類は即確定（AI 自動起動なし）。今回の値に合わせた調査レポートを AI に生成させます。"
              className="min-w-[9rem] rounded-md bg-cyan-500/15 px-3 py-1.5 text-center text-xs font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30 transition hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {submitting === "generate-report"
                ? "AIレポート生成中…"
                : "AIレポートを生成"}
            </button>
          )}
          {canPromote && (
            <button
              type="button"
              disabled={submitting !== null || promoted}
              onClick={promote}
              title="この障害を既知パターンへ焼き付けます。以後の同型障害は完全一致の高速パスで即・無料・決定論に既知分類されます。"
              className={cn(
                "min-w-[9rem] rounded-md px-3 py-1.5 text-center text-xs font-semibold ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95 disabled:active:scale-100",
                promoted
                  ? "bg-emerald-500/25 text-emerald-200 ring-emerald-400/60 disabled:opacity-100"
                  : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50",
              )}
            >
              {submitting === "promote"
                ? "昇格中…"
                : promoted
                  ? "✓ 既知パターンへ昇格済み"
                  : "既知パターンへ昇格"}
            </button>
          )}
        </div>
      )}
      {promoted && (
        <p className="flex items-start gap-1.5 border-t border-slate-700/40 pt-2 text-[11px] leading-snug text-emerald-300">
          <span aria-hidden>✓</span>
          この障害を既知パターンへ焼き付けました。次回の同型障害は完全一致の高速パスで即・既知に分類されます。
        </p>
      )}
      {reviewState === "REJECTED" && alert.feedback?.operatorNote && (
        <p className="text-[11px] leading-snug text-slate-300">
          却下理由：「{alert.feedback.operatorNote}」
        </p>
      )}
    </Card>
  );
}

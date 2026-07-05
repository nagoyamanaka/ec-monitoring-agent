import { useState } from "react";
import { Card } from "@shared/ui/tremor";
import { cn } from "@shared/ui/cn";
import { CheckCircleIcon, XCircleIcon } from "@shared/ui/DecisionIcon";
import type { AlertView } from "../../domain/AlertView";
import { alertReviewState } from "../../domain/alertReview";
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
   * 未知/類似既知（SIMILARITY）Alert を「回数不問で既知パターンへ手動即時昇格（結晶化）」する。
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
 * 却下の理由入力はパネルを差し替えず**トグルの下にインライン展開**する（文脈を消さない）。
 * 却下フローの主役は「却下して AI 再調査」（人間の指摘→エージェントやり直しの見せ場）、
 * 記録だけの却下は secondary に格下げする。
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
  // 承認の完了通知（このセッションで承認した時のみ）。承認が「押して終わり」でなく
  // 学習シグナルとして効いたこと・次アクション（昇格）が開いたことを1行で示す。
  const [approved, setApproved] = useState(false);
  // 却下の完了通知（承認と対）。「記録がどこに効いたか」を無言にしない。
  // withdrewLearning=承認→却下の訂正＝backend が類似学習・自動昇格を撤回した（見せ場）。
  const [rejectedNotice, setRejectedNotice] = useState<{
    withdrewLearning: boolean;
  } | null>(null);
  // 却下フロー：理由/修正方針の入力を開いているか・入力中の note。
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  // 送信失敗の可視化。無言で元に戻ると「押したのに何も起きない」に見えるため必ず1行出す。
  const [error, setError] = useState<string | null>(null);
  const reviewState = alertReviewState(alert);
  const trimmedNote = note.trim();

  // 既知一致でレポート未着なら「オンデマンド生成」を出す（既知は AI を自動起動しないため）。
  const canGenerateReport =
    !!onGenerateReport &&
    alert.classification.type === "known" &&
    alert.report === null;
  // 有効な調査レポートがあり、かつ「承認済み」のときだけ「既知へ昇格（結晶化）」を出す。
  // 承認＝分類が正しいと確定＝この障害を既知パターンへ焼き付けてよい、という導線ゲート。
  // 未承認の障害を先に既知化してしまう事故を防ぎ、「承認→昇格」の順序を UI で強制する。
  // 対象は未知に加え類似既知（SIMILARITY）＝承認を重ねた準・既知が永遠に類似止まり（確度 <100%）に
  // ならず、完全一致の既知（即・確度100%）へ登れるようにする。完全一致（EXACT_MATCH）は既に
  // 高速パスに乗っているため対象外（backend の isPromotableClassification と同条件）。
  const promotableClassification =
    alert.classification.type === "unknown" ||
    alert.classification.source === "SIMILARITY";
  const canPromote =
    !!onPromote &&
    reviewState === "APPROVED" &&
    promotableClassification &&
    alert.report !== null &&
    !alert.report.isFallback;

  const generateReport = async () => {
    if (submitting || !onGenerateReport) return;
    setSubmitting("generate-report");
    setError(null);
    try {
      await onGenerateReport(alert.id);
    } catch {
      setError("AI レポートの生成に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(null);
    }
  };

  const promote = async () => {
    if (submitting || !onPromote) return;
    setSubmitting("promote");
    setError(null);
    try {
      await onPromote(alert.id);
      setPromoted(true);
    } catch {
      setError("昇格に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(null);
    }
  };

  const decide = async (decision: FeedbackDecision, operatorNote?: string) => {
    if (submitting || !onDecision) return;
    // 承認→却下の訂正かは送信前の判定で決まる（成功後は reviewState が変わるため先に取る）。
    const wasApproved = reviewState === "APPROVED";
    setSubmitting(decision);
    setError(null);
    try {
      await onDecision(alert.id, decision, operatorNote);
      // 成功後は却下入力を畳む（再取得した feedback でトグルの選択状態が更新される）。
      setRejecting(false);
      setNote("");
      setApproved(decision === "approve");
      setRejectedNotice(
        decision === "reject" ? { withdrewLearning: wasApproved } : null,
      );
    } catch {
      setError("判定の送信に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(null);
    }
  };

  const requestReinvestigation = async () => {
    if (submitting || !onReinvestigate || !trimmedNote) return;
    setSubmitting("reinvestigate");
    setError(null);
    try {
      await onReinvestigate(alert.id, trimmedNote);
      setRejecting(false);
      setNote("");
    } catch {
      setError("再調査の依頼に失敗しました。もう一度お試しください。");
    } finally {
      setSubmitting(null);
    }
  };

  const openReject = () => {
    if (submitting) return;
    setRejecting(true);
    setApproved(false);
    setRejectedNotice(null);
    setError(null);
  };

  const cancelReject = () => {
    if (submitting) return;
    setRejecting(false);
    setNote("");
  };

  // 再調査中（人間の指摘を反映して AI が再分析中）は判定を伏せて待つ。
  if (alert.status === "ANALYZING") return null;

  return (
    <Card
      className={cn("space-y-2 !bg-slate-800/40 !p-3 !ring-slate-700/60", className)}
    >
      {/* 間延び対策：両端寄せ（justify-between）をやめ、ラベル＋ボタンを左に詰める。 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold text-slate-200">
          AI の分類をレビュー
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
                : "bg-emerald-500/10 text-emerald-300/90 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/20 disabled:opacity-50",
            )}
          >
            {(() => {
              const label =
                submitting === "approve"
                  ? "送信中…"
                  : reviewState === "APPROVED"
                    ? "承認済み"
                    : "承認";
              // ラベルが変わるたびキーが変わり、ボタン→ステータス表記がフェード差し替わる。
              return (
                <span
                  key={label}
                  className="badge-fade-in inline-flex items-center justify-center gap-1"
                >
                  {submitting !== "approve" && <CheckCircleIcon />}
                  {label}
                </span>
              );
            })()}
          </button>
          <button
            type="button"
            aria-pressed={reviewState === "REJECTED"}
            aria-expanded={rejecting}
            disabled={submitting !== null || reviewState === "REJECTED"}
            onClick={() => (rejecting ? cancelReject() : openReject())}
            className={cn(
              "min-w-[5.5rem] rounded-md px-3 py-1.5 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95 disabled:active:scale-100",
              reviewState === "REJECTED"
                ? "bg-rose-500/25 text-rose-200 ring-2 ring-inset ring-rose-400/60 disabled:opacity-100"
                : rejecting
                  ? "bg-rose-500/20 text-rose-200 ring-2 ring-inset ring-rose-400/50"
                  : "bg-rose-500/10 text-rose-300/90 ring-1 ring-inset ring-rose-500/25 hover:bg-rose-500/20 disabled:opacity-50",
            )}
          >
            {(() => {
              const label = reviewState === "REJECTED" ? "却下済み" : "却下";
              return (
                <span
                  key={label}
                  className="badge-fade-in inline-flex items-center justify-center gap-1"
                >
                  <XCircleIcon />
                  {label}
                </span>
              );
            })()}
          </button>
        </div>
      </div>
      {rejecting && (
        <div className="space-y-2 border-t border-slate-700/40 pt-2">
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
            {onReinvestigate ? (
              <>
                {/* 記録だけの却下は secondary（ghost）。主役は右の再調査＝人間の指摘を AI に返す経路。 */}
                <button
                  type="button"
                  disabled={submitting !== null || trimmedNote === ""}
                  onClick={() => decide("reject", trimmedNote)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-rose-300/90 transition hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50"
                >
                  {submitting === "reject" ? "送信中…" : "却下のみ（記録だけ）"}
                </button>
                <button
                  type="button"
                  disabled={submitting !== null || trimmedNote === ""}
                  onClick={requestReinvestigation}
                  className="min-w-[10rem] rounded-md bg-cyan-500/20 px-4 py-1.5 text-center text-xs font-semibold text-cyan-200 ring-1 ring-inset ring-cyan-400/40 transition hover:bg-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                  {submitting === "reinvestigate"
                    ? "再調査を依頼中…"
                    : "却下して AI 再調査"}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={submitting !== null || trimmedNote === ""}
                onClick={() => decide("reject", trimmedNote)}
                className="min-w-[6rem] rounded-md bg-rose-500/15 px-3 py-1.5 text-center text-xs font-semibold text-rose-300 ring-1 ring-inset ring-rose-500/30 transition hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {submitting === "reject" ? "送信中…" : "却下する"}
              </button>
            )}
          </div>
        </div>
      )}
      {approved && reviewState !== "REJECTED" && !rejecting && (
        <p className="flex items-start gap-1.5 border-t border-slate-700/40 pt-2 text-[11px] leading-snug text-emerald-300">
          <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            承認を記録しました。AI の分類が正しかったことが学習シグナルとして残ります。
            {canPromote &&
              "下の「既知パターンへ昇格」で、同型障害の即時分類に焼き付けられます。"}
          </span>
        </p>
      )}
      {/* 却下の完了通知（承認と対）。記録が正答率に効いたこと・訂正なら学習の撤回まで語る。
          decide() が判定のたびにセット/クリアするため reviewState での追加ガードは持たない
          （承認→却下の訂正直後は refetch まで reviewState が APPROVED のままの窓がある）。 */}
      {rejectedNotice && !rejecting && (
        <p className="flex items-start gap-1.5 border-t border-slate-700/40 pt-2 text-[11px] leading-snug text-rose-300">
          <XCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            却下を記録しました。AI
            の分類が誤りだったことが学習シグナルとして残ります（Analytics
            の分類正答率に反映）。
            {rejectedNotice.withdrewLearning &&
              "承認時に積まれていた類似学習・自動昇格は撤回しました。"}
          </span>
        </p>
      )}
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
              {submitting === "promote" ? (
                "昇格中…"
              ) : promoted ? (
                <span className="inline-flex items-center justify-center gap-1">
                  <CheckCircleIcon />
                  既知パターンへ昇格済み
                </span>
              ) : (
                "既知パターンへ昇格"
              )}
            </button>
          )}
        </div>
      )}
      {promoted && (
        <p className="flex items-start gap-1.5 border-t border-slate-700/40 pt-2 text-[11px] leading-snug text-emerald-300">
          <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          この障害を既知パターンへ焼き付けました。次回の同型障害は完全一致の高速パスで即・既知に分類されます。
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="border-t border-slate-700/40 pt-2 text-[11px] leading-snug text-rose-300"
        >
          {error}
        </p>
      )}
      {/* 過去に却下済みの状態表示（セッション通知が出ている間は重複させない）。
          裸の理由 echo でなく「記録が何に効いているか」のラベルを添える。 */}
      {reviewState === "REJECTED" && !rejectedNotice && (
        <div className="space-y-0.5 border-t border-slate-700/40 pt-2 text-[11px] leading-snug">
          <p className="flex items-center gap-1.5 font-medium text-rose-300/90">
            <XCircleIcon />
            却下済み — 誤分類として記録されています（Analytics の分類正答率に反映）
          </p>
          {alert.feedback?.operatorNote && (
            <p className="text-slate-300">
              指摘メモ：「{alert.feedback.operatorNote}」
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

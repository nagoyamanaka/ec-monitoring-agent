import { useState } from "react";
import { cn } from "@shared/ui/cn";
import type { AlertView } from "../../domain/AlertView";

/**
 * ワンクリック再調査で AI へ渡す定型の指摘文（operatorNote）。
 * backend の POST /alerts/:id/reinvestigate は operatorNote 必須（人間の指摘を文脈に載せる契約）
 * のため、fallback からの「やり直し」では前回失敗の事実をそのまま指摘として渡す。
 */
export const FALLBACK_REINVESTIGATE_NOTE =
  "前回の自動調査は出力不正で失敗しました（fallback）。収集済みの証拠に基づき、もう一度調査してください。";

export interface FallbackRecoveryBannerProps {
  alert: AlertView;
  /**
   * 「再調査を実行」（既存 POST /alerts/:id/reinvestigate の結線・タスク E3）。
   * 渡されない場合は従来どおり警告バナーのみ（ボタンなし）。
   */
  onReinvestigate?: (
    alertId: string,
    operatorNote: string,
  ) => void | Promise<void>;
  className?: string;
}

/**
 * AI 調査失敗（fallback レポート）の警告バナー＋復帰導線（タスク E3・D3 連動）。
 * 従来は「再調査をおすすめします」と言うだけでドロワー/詳細ページのどちらにも
 * 再調査ボタンが無い行き止まりだった＝バナー直下にワンクリックの「再調査を実行」を置く。
 * 結果（ANALYZING→OPEN ＋ 新レポート）は SSE で届くため、ここは依頼の送信だけを担う。
 */
export function FallbackRecoveryBanner({
  alert,
  onReinvestigate,
  className,
}: FallbackRecoveryBannerProps) {
  const [submitting, setSubmitting] = useState(false);

  const reinvestigate = async () => {
    if (submitting || !onReinvestigate) return;
    setSubmitting(true);
    try {
      await onReinvestigate(alert.id, FALLBACK_REINVESTIGATE_NOTE);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-tremor-default bg-amber-500/10 px-4 py-3 text-amber-200 ring-1 ring-inset ring-amber-500/25",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden>⚠</span>
        AI 調査に失敗・暫定表示
      </p>
      <p className="mt-1 text-xs text-amber-200/80">
        確信度は参考値です（再調査をおすすめします）
      </p>
      {onReinvestigate && (
        <button
          type="button"
          disabled={submitting}
          onClick={reinvestigate}
          title="収集済みの証拠を使って AI 調査をもう一度実行します。結果は完了次第この画面に反映されます。"
          className="mt-2 min-w-[8.5rem] rounded-md bg-amber-500/20 px-3 py-1.5 text-center text-xs font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40 transition hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          {submitting ? "再調査を依頼中…" : "⟳ 再調査を実行"}
        </button>
      )}
    </div>
  );
}

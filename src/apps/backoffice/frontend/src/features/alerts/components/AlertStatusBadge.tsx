import { cn } from "@shared/ui/cn";
import { type AlertView, isAnalyzing } from "../domain/AlertView";
import { alertReviewState } from "../domain/alertReview";

export interface AlertStatusBadgeProps {
  alert: AlertView;
  className?: string;
}

type Tone = { readonly label: string; readonly cls: string };

/**
 * alert の「対応状態」をひとことで示すバッジ。
 * 分析中 → レビュー待ち → 承認済み/却下済み の遷移を一覧・ドロワーで共通表示し、
 * 「自分が対応すべき行（＝レビュー待ち）」を一目で分かるようにする。
 * レビュー状態は feedback ベース（alertReviewState）で既知・未知を統一して扱う。
 */
function toneOf(alert: AlertView): Tone {
  if (isAnalyzing(alert)) {
    return {
      label: "分析中",
      cls: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
    };
  }
  switch (alertReviewState(alert)) {
    case "APPROVED":
      return {
        label: "承認済み",
        cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
      };
    case "REJECTED":
      return {
        label: "却下済み",
        cls: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
      };
    case "PENDING":
      return {
        label: "レビュー待ち",
        cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
      };
  }
}

export function AlertStatusBadge({ alert, className }: AlertStatusBadgeProps) {
  const { label, cls } = toneOf(alert);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        cls,
        className,
      )}
    >
      {label}
    </span>
  );
}

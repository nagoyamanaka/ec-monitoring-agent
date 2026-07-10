import { cn } from "@shared/ui/cn";

export interface ExactMatchBadgeProps {
  /** chip=一覧行レール向けの控えめ表示 / panel=ドロワー向けの確定の強調表示。 */
  variant?: "chip" | "panel";
  className?: string;
}

/**
 * 「過去障害と完全一致」を示すバッジ。
 * 既知パターンの完全一致は AI 推定（確率）ではなく決定論的な確定分類なので、
 * 確信度ゲージ/％の代わりにこの“事実”を見せる（実体と表示を一致させる）。
 */
export function ExactMatchBadge({
  variant = "chip",
  className,
}: ExactMatchBadgeProps) {
  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300",
          className,
        )}
        title="既知の過去障害パターンと完全一致（AI 推定ではなく確定分類）"
      >
        <span aria-hidden>✓</span> 完全一致
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg bg-emerald-500/10 px-4 py-3",
        className,
      )}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
        aria-hidden
      >
        ✓
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-emerald-200">過去障害と完全一致</p>
        <p className="text-xs leading-relaxed text-emerald-300/70">
          既知パターンに一致したため、AI 推定ではなく確定分類です。
        </p>
      </div>
    </div>
  );
}

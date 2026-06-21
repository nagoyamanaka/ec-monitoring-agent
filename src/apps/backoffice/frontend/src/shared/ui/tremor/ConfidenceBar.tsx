import { ProgressBar } from "@tremor/react";
import { confidenceColor } from "./colors";
import { cn } from "../cn";

export interface ConfidenceBarProps {
  /** 0..1 の確信度。範囲外はクランプする。 */
  confidence: number;
  /** バー左のラベル。空文字で非表示。 */
  label?: string;
  className?: string;
}

/**
 * AI 確信度を「ラベル＋横バー＋%」で示す一覧向けウィジェット。
 * 一覧スキャンで浮きやすいドーナツゲージ（ConfidenceGauge）に対し、
 * 行内で割合を読ませる用途。色は confidenceColor（rose→amber→emerald）を共用。
 */
export function ConfidenceBar({
  confidence,
  label = "確信度",
  className,
}: ConfidenceBarProps) {
  const clamped = Math.min(1, Math.max(0, confidence));
  const percent = Math.round(clamped * 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label ? (
        <span className="shrink-0 text-xs text-tremor-content">{label}</span>
      ) : null}
      <ProgressBar
        value={percent}
        color={confidenceColor(clamped)}
        className="min-w-0 flex-1"
      />
      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-300">
        {percent}%
      </span>
    </div>
  );
}

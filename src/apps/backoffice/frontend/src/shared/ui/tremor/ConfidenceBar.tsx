import { ProgressBar } from "@tremor/react";
import { confidenceBrandColor } from "./colors";
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
 * 行内で割合を読ませる用途。色はブランドトーン（confidenceBrandColor: cyan/低確信は slate）
 * ＝隣の重大度バッジ（HIGH=rose）と意味が衝突しない。
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
        color={confidenceBrandColor(clamped)}
        className="min-w-0 flex-1"
      />
      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-300">
        {percent}%
      </span>
    </div>
  );
}

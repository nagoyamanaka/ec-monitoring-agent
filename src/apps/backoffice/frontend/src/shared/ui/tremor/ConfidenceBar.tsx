import {
  confidenceBrandColor,
  tremorColorToCss,
  GAUGE_TRACK_CSS,
} from "./colors";
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
 *
 * L2: 中身は Tremor（ProgressBar）でなく自作 div バー。トラック色・角丸・太さを
 * 隣接する自作バー（CalibratedConfidence の `h-2.5 rounded-full bg-slate-700/40`）に
 * 揃え、Tremor 素の寸法・トラック色との微妙な声の違いを解消する。呼び出し側は不変。
 */
export function ConfidenceBar({
  confidence,
  label = "確信度",
  className,
}: ConfidenceBarProps) {
  const clamped = Math.min(1, Math.max(0, confidence));
  const percent = Math.round(clamped * 100);
  const fill = tremorColorToCss(confidenceBrandColor(clamped));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label ? (
        <span className="shrink-0 text-xs text-slate-400">{label}</span>
      ) : null}
      <div
        className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: GAUGE_TRACK_CSS }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[600ms] ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%`, backgroundColor: fill }}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-300">
        {percent}%
      </span>
    </div>
  );
}

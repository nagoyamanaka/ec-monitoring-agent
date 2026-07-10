import { confidenceColor } from "./colors";
import { cn } from "../cn";

export interface ConfidenceChipProps {
  /** 0..1 の確信度。範囲外はクランプする。 */
  confidence: number;
  /** 数値の前に出すラベル。確信度の“正体”（AI確信度／類似度 等）を明示する。 */
  label?: string;
  /**
   * 確信度の由来をトーン（色）で区別する。
   * "ai"=cyan（AI 推定）/ "match"=emerald（既知パターン一致＝確定寄り）。
   * 省略時は従来どおり confidenceColor のしきい値色（rose/amber/emerald）。
   */
  tone?: "ai" | "match";
  className?: string;
}

/** confidenceColor（rose/amber/emerald）→ チップの数値テキスト色。 */
const TEXT_BY_COLOR: Record<string, string> = {
  rose: "text-rose-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
};

/**
 * tone → チップの数値テキスト色（由来トーン優先時）。
 * "ai" は低確信（裏付けなし上限40%近傍）を slate に落とし、リング/バーの
 * confidenceBrandColor と同じ「弱い数字は視覚強度も弱く」を行内でも守る。
 */
function toneTextColor(
  tone: NonNullable<ConfidenceChipProps["tone"]>,
  confidence: number,
): string {
  if (tone === "match") return "text-emerald-300";
  return confidence < 0.5 ? "text-slate-300" : "text-cyan-300";
}

/**
 * 一覧行向けのコンパクトな確信度表示（「確信度 90%」）。
 * 全幅バー（ConfidenceBar）やドーナツ（ConfidenceGauge）に対し、行内で控えめに添える用途。
 * 視覚階層上は副次情報なので主役（eventName）より弱く見せる。
 */
export function ConfidenceChip({
  confidence,
  label = "確信度",
  tone,
  className,
}: ConfidenceChipProps) {
  const clamped = Math.min(1, Math.max(0, confidence));
  const percent = Math.round(clamped * 100);
  const valueColor = tone
    ? toneTextColor(tone, clamped)
    : TEXT_BY_COLOR[confidenceColor(clamped)];
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)}>
      <span className="text-slate-300">{label}</span>
      <span className={cn("font-semibold tabular-nums", valueColor)}>
        {percent}%
      </span>
    </span>
  );
}

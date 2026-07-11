import { useEffect, useState } from "react";
import { confidenceColor, tremorColorToCss, GAUGE_TRACK_CSS } from "./colors";
import { cn } from "../cn";

export interface ConfidenceGaugeProps {
  /** 0..1 の確信度。範囲外はクランプする。 */
  confidence: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** ゲージ下にラベルを出すか。 */
  label?: string;
  /**
   * リングの色（Tremor の color 名）。指定時はしきい値色（confidenceColor）より優先。
   * 確定（既知）= emerald / AI 推定 = cyan のようにトーンで由来を区別する用途。
   */
  color?: string;
  /**
   * マウント時に 0%→確信度へカウントアップ演出する（タスク12・ドロワー専用）。
   * reduced-motion 環境では即値表示にフォールバックする。
   */
  animate?: boolean;
  className?: string;
}

/** reduced-motion を尊重するか（jsdom で matchMedia 未実装でも安全に false 判定）。 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * サイズ → リングの幾何（半径・線幅・中央%の文字クラス）。
 * 旧 Tremor ProgressCircle の各サイズ実寸（svg 幅 = 2*(radius+strokeWidth)）に合わせ、
 * 差し替えでレイアウトがずれないようにする。線端は round＝自作バーの rounded-full と同じ声。
 */
const SIZE: Record<
  NonNullable<ConfidenceGaugeProps["size"]>,
  { radius: number; stroke: number; text: string }
> = {
  xs: { radius: 15, stroke: 3, text: "text-[11px]" },
  sm: { radius: 19, stroke: 4, text: "text-xs" },
  md: { radius: 24, stroke: 5, text: "text-sm" },
  lg: { radius: 32, stroke: 6, text: "text-base" },
  xl: { radius: 40, stroke: 6, text: "text-lg" },
};

/**
 * AI 確信度を割合ゲージで可視化する共通ウィジェット（タスク6/11/12 で共用）。
 * confidence→% 表記＋しきい値/ブランドトーンで色分け。
 *
 * L2: 中身は Tremor（ProgressCircle）でなく自作 SVG リング。トラック色（slate-700/40）・
 * 線端（round）・太さを隣接する自作バーに揃え、Tremor 素の癖を解消する。呼び出し側は不変。
 */
export function ConfidenceGauge({
  confidence,
  size = "md",
  label,
  color,
  animate = false,
  className,
}: ConfidenceGaugeProps) {
  const clamped = Math.min(1, Math.max(0, confidence));
  // 表示中の値（カウントアップで 0→clamped へ近づく）。色は最終値で固定して点滅を防ぐ。
  const [display, setDisplay] = useState(
    animate && !prefersReducedMotion() ? 0 : clamped,
  );

  useEffect(() => {
    if (!animate || prefersReducedMotion()) {
      setDisplay(clamped);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(clamped * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate, clamped]);

  const percent = Math.round(display * 100);
  const { radius, stroke, text } = SIZE[size];
  const box = 2 * (radius + stroke);
  const center = box / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, display)));
  const ringColor = tremorColorToCss(color ?? confidenceColor(clamped));

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: box, height: box }}>
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          aria-hidden="true"
          className="-rotate-90"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={GAUGE_TRACK_CSS}
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-slate-100",
            text,
          )}
        >
          {percent}%
        </span>
      </div>
      {label ? <span className="text-xs text-slate-400">{label}</span> : null}
    </div>
  );
}

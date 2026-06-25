import { useEffect, useState } from "react";
import { ProgressCircle, Flex, Text, Bold } from "@tremor/react";
import { confidenceColor } from "./colors";
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
 * AI 確信度を割合ゲージで可視化する共通ウィジェット（タスク6/11/12 で共用）。
 * confidence→% 表記＋しきい値で色分け（rose/amber/emerald）。
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
  return (
    <Flex
      flexDirection="col"
      alignItems="center"
      className={cn("gap-1", className)}
    >
      <ProgressCircle
        value={percent}
        size={size}
        color={color ?? confidenceColor(clamped)}
      >
        <Text className="text-xs">
          <Bold>{percent}%</Bold>
        </Text>
      </ProgressCircle>
      {label ? <Text className="text-xs text-tremor-content">{label}</Text> : null}
    </Flex>
  );
}

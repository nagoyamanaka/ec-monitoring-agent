import { ProgressCircle, Flex, Text, Bold } from "@tremor/react";
import { confidenceColor } from "./colors";
import { cn } from "../cn";

export interface ConfidenceGaugeProps {
  /** 0..1 の確信度。範囲外はクランプする。 */
  confidence: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** ゲージ下にラベルを出すか。 */
  label?: string;
  className?: string;
}

/**
 * AI 確信度を割合ゲージで可視化する共通ウィジェット（タスク6/11/12 で共用）。
 * confidence→% 表記＋しきい値で色分け（rose/amber/emerald）。
 */
export function ConfidenceGauge({
  confidence,
  size = "md",
  label,
  className,
}: ConfidenceGaugeProps) {
  const clamped = Math.min(1, Math.max(0, confidence));
  const percent = Math.round(clamped * 100);
  return (
    <Flex
      flexDirection="col"
      alignItems="center"
      className={cn("gap-1", className)}
    >
      <ProgressCircle
        value={percent}
        size={size}
        color={confidenceColor(clamped)}
      >
        <Text className="text-xs">
          <Bold>{percent}%</Bold>
        </Text>
      </ProgressCircle>
      {label ? <Text className="text-xs text-tremor-content">{label}</Text> : null}
    </Flex>
  );
}

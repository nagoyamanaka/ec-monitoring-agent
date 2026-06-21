import type { Color } from "@tremor/react";
import type { SeverityLevel } from "../SeverityBadge";

/**
 * 危険度ランク → Tremor チャート色。SeverityBadge のランク色（rose/amber/sky）と整合させる。
 * デザイントークン: CRITICAL/HIGH=rose, WARNING/MEDIUM=amber, INFO/LOW=sky。
 */
export function rankColor(level: SeverityLevel): Color {
  switch (level) {
    case "CRITICAL":
    case "HIGH":
      return "rose";
    case "WARNING":
    case "MEDIUM":
      return "amber";
    case "INFO":
    case "LOW":
      return "sky";
  }
}

/**
 * confidence(0..1) → Tremor 色。低→高で rose → amber → emerald。
 * confidence ゲージ・AI 精度トラッキング（analytics）で共用する。
 */
export function confidenceColor(confidence: number): Color {
  if (confidence < 0.4) return "rose";
  if (confidence < 0.7) return "amber";
  return "emerald";
}

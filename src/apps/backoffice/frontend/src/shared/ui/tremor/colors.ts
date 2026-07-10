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
    case "PENDING":
      return "slate";
  }
}

/**
 * confidence(0..1) → Tremor 色。低→高で rose → amber → emerald。
 * 「正解/不正解」の評価セマンティクス（analytics の正答率ゲージ）専用。
 * AI 確信度には使わない（confidenceBrandColor を使う）。
 */
export function confidenceColor(confidence: number): Color {
  if (confidence < 0.4) return "rose";
  if (confidence < 0.7) return "amber";
  return "emerald";
}

/**
 * AI 確信度(0..1) → ブランドトーン色。
 * 確信度は良し悪しの評価ではないため emerald/rose の評価色を使わず cyan に統一する
 * （HIGH リスク×緑90%の意味衝突を避け、緑は承認/既知/正解の完了セマンティクスへ温存）。
 * 裏付けなし上限（40%）近傍の弱い数字は slate に落とし、視覚強度でも弱さを語る。
 */
export function confidenceBrandColor(confidence: number): Color {
  return confidence < 0.5 ? "slate" : "cyan";
}

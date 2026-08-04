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

/**
 * Tremor の色名 → CSS 色（自作 SVG/div ゲージの stroke/背景に使う）。
 * L2: ConfidenceGauge の中身を Tremor（ProgressCircle）から自作へ差し替える際、
 * 隣接する自作バー（CalibratedConfidence 等）と同じトーンで塗るための単一表。
 * （横バー版の ConfidenceBar は予報カードが唯一の利用者だったため、確信度%の撤去＝
 * ADR-32 と同時に削除した。）
 * 確信度で使う色（cyan/slate/emerald）＋しきい値色（rose/amber/sky）を Tailwind 400 系で解決し、
 * 未知の色名は控えめな slate にフォールバックする。
 */
const TREMOR_COLOR_CSS: Record<string, string> = {
  cyan: "rgb(34 211 238)", // cyan-400（AI 確信度のブランドトーン）
  emerald: "rgb(52 211 153)", // emerald-400（既知一致＝確定寄り）
  slate: "rgb(100 116 139)", // slate-500（裏付けなし＝弱い数字は弱く）
  rose: "rgb(251 113 133)", // rose-400
  amber: "rgb(251 191 36)", // amber-400
  sky: "rgb(56 189 248)", // sky-400
};

export function tremorColorToCss(color: Color | string): string {
  return TREMOR_COLOR_CSS[color] ?? TREMOR_COLOR_CSS.slate;
}

/**
 * 自作ゲージ/バー共通のトラック色。隣接する自作バー（CalibratedConfidence の
 * `bg-slate-700/40`）と同一＝ G2「線でなく面」の面トーンに揃える。
 */
export const GAUGE_TRACK_CSS = "rgb(51 65 85 / 0.4)"; // slate-700/40

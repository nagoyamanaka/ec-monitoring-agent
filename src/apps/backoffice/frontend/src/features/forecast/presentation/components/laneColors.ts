import type { ReferencedChipTone } from "@shared/ui/ReferencedEvidenceCard";

/**
 * 予兆の引用レーン（種別）→ 配色の単一ソース。
 * ポスター/動画との連続性を守るため「変更予定=cyan / 負荷予定=amber / 過去の記憶=emerald」は不変。
 * CitationList（引用チップ）と ConvergenceMiniFlow（収束ミニフロー）が同じ色軸で語れるよう共有する。
 */

/** 種別の塗り分け: 未来の変更=cyan（進行中）/ スケジュール=amber（時限）/ 過去事例=emerald（既知系）。 */
const LANE_TONES: Record<string, ReferencedChipTone> = {
  FUTURE_CHANGE: "cyan",
  SCHEDULE: "amber",
  MEMORY: "emerald",
};

export function laneTone(kind: string): ReferencedChipTone {
  return LANE_TONES[kind] ?? "cyan";
}

/** レーン左ボーダー色（チップ色と同系＝レーンと種別チップが同じ軸だと分かる）。 */
export const LANE_BORDERS: Record<string, string> = {
  FUTURE_CHANGE: "border-cyan-500/40",
  SCHEDULE: "border-amber-500/40",
  MEMORY: "border-emerald-500/40",
};

/** 収束ミニフローの入力タイル配色（tone と同軸）。
 *  Tier3（分類タグ）＝色相は面/枠で示し文字は中立 slate（顕著性は結論ノードに譲る）。 */
export const LANE_TILE_CLASS: Record<ReferencedChipTone, string> = {
  cyan: "bg-cyan-500/10 text-slate-200 ring-cyan-500/30",
  emerald: "bg-emerald-500/10 text-slate-200 ring-emerald-500/30",
  amber: "bg-amber-500/10 text-slate-200 ring-amber-500/30",
};

/** LLM 散文中の引用 id 参照（RiskCard のインライン参照）。点線下線＝クリック可の既存語彙
 *  （C-3b の台帳セルと同じ）に、レーン色相を文字色で乗せて「下のどのレーンに飛ぶか」を予告する。 */
export const INLINE_REF_CLASS: Record<ReferencedChipTone, string> = {
  cyan: "text-cyan-300 decoration-cyan-400/60",
  emerald: "text-emerald-300 decoration-emerald-400/60",
  amber: "text-amber-300 decoration-amber-400/60",
};

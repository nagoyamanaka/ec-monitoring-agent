import { type AlertView, isAnalyzing } from "./AlertView";

/**
 * 「確信度」の“正体”を分類から導く純関数。
 *
 * 背景: 旧 `primaryConfidence` は既知パターンの一致度（ルールベース・AI非介在）と
 * AI 調査の推定確信度を同じ number に潰していた。結果、既知の完全一致まで
 * 「AI 確信度 100%」と表示され、実体（決定論的なパターン一致）と食い違っていた。
 *
 * ここでは確信度を“種別”として返し、表示側が
 *  - exact-match → 「過去障害と完全一致」（％ではなく確定の事実）
 *  - known       → 「パターン一致度 N%」（既知パターンへの部分一致）
 *  - ai          → 「AI 確信度 N%」（LLM 調査の推定）
 * と描き分けられるようにする。confidence の値ではなく“どこ由来か”を語るのが責務。
 */
export type AlertConfidence =
  | { readonly kind: "exact-match" } // 既知パターンに完全一致（confidence>=1・AI非介在の確定分類）
  | { readonly kind: "known"; readonly value: number } // 既知パターンへの部分一致（ルールベース）
  | { readonly kind: "ai"; readonly value: number } // AI 調査の推定確信度（0..1）
  | { readonly kind: "none" }; // 分析中・推定なし

export function alertConfidence(alert: AlertView): AlertConfidence {
  if (isAnalyzing(alert)) return { kind: "none" };

  if (alert.classification.type === "known") {
    const { source, confidence } = alert.classification;
    // 由来で出し分ける（confidence>=1 の嗅ぎ分けでなく source を一級判別子に）。
    // EXACT_MATCH は AI 推定でない確定分類なので％表示せず「完全一致」。
    // SIMILARITY/INFERENCE は部分一致なのでパターン一致度 N% を見せる。
    return source === "EXACT_MATCH"
      ? { kind: "exact-match" }
      : { kind: "known", value: confidence };
  }

  // 未知パターンは AI 調査レポートの confidence が推定確信度。レポート未着は none。
  if (alert.report) return { kind: "ai", value: alert.report.confidence };
  return { kind: "none" };
}

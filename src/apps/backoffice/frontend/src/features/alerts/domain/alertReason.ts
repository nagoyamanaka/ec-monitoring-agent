import { type AlertView, isAnalyzing } from "./AlertView";

/**
 * 「何が起きたと推定したか」を分類/調査から導く純関数。
 * - known: 既知パターン名（classification）
 * - ai: AI 調査の推定パターン名（investigationReport.suggestedPatternName）
 * - analyzing: 調査中（まだ推定が無い）
 * 確信度はこの推定対象に対する値であり、行では確信度チップと対で初めて意味を持つ。
 */
export type AlertReason =
  | { readonly kind: "known"; readonly patternName: string }
  | { readonly kind: "ai"; readonly patternName: string }
  | { readonly kind: "analyzing" };

export function alertReason(alert: AlertView): AlertReason {
  if (isAnalyzing(alert)) return { kind: "analyzing" };
  if (alert.classification.type === "known") {
    return { kind: "known", patternName: alert.classification.patternName };
  }
  if (alert.report) {
    return { kind: "ai", patternName: alert.report.suggestedPatternName };
  }
  return { kind: "analyzing" };
}

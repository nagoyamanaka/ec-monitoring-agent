import type { AlertView } from "./AlertView";

/**
 * オペレータのレビュー状態を feedback（承認/却下の単一ソース）から導く純関数。
 * 既知パターンアラートは investigationReport を持たず reviewStatus では判定できないため、
 * feedback の有無/isCorrect で既知・未知を統一して扱う（backend も feedback は両者で記録する）。
 */
export type AlertReviewState = "PENDING" | "APPROVED" | "REJECTED";

export function alertReviewState(alert: AlertView): AlertReviewState {
  if (!alert.feedback) return "PENDING";
  return alert.feedback.isCorrect ? "APPROVED" : "REJECTED";
}

export function isAlertReviewed(alert: AlertView): boolean {
  return alert.feedback !== null;
}

import { type AlertView, isAnalyzing } from "./AlertView";

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

/**
 * 一覧カードのバッジとヘッダの件数チップが共有する「対応状態」の単一ソース。
 * 分析中はレビュー対象外（feedback 未付与でも PENDING に数えない）ため、
 * ANALYZING をレビュー状態より優先して返す。
 * バッジ表示と件数集計を別々に計算すると「レビュー待ち 0件 vs カードはレビュー待ち」の
 * 矛盾が再発するので、状態算出は必ずこの関数を経由すること。
 */
export type AlertWorkState = "ANALYZING" | AlertReviewState;

export function alertWorkState(alert: AlertView): AlertWorkState {
  if (isAnalyzing(alert)) return "ANALYZING";
  return alertReviewState(alert);
}

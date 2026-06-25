import type { AlertView } from "../domain/AlertView";
import type { InvestigationReportView } from "../domain/InvestigationReportView";

/** テスト用 InvestigationReportView ビルダ。 */
export function makeReport(
  overrides: Partial<InvestigationReportView> = {},
): InvestigationReportView {
  return {
    summary: "未知のレイテンシ急増を検知",
    confidence: 0.82,
    severity: "CRITICAL",
    investigationSteps: [{ text: "ログ確認" }, { text: "メトリクス相関" }],
    suggestedActions: [{ text: "ロールバック" }, { text: "スケールアウト" }],
    suggestedPatternName: "latency-spike",
    reviewStatus: "PENDING_REVIEW",
    investigatedAt: "2026-06-21T00:00:00.000Z",
    isFallback: false,
    remediable: false,
    relatedAlerts: [],
    ...overrides,
  };
}

/** テスト用 AlertView ビルダ（既定は調査済み OPEN の重大アラート）。 */
export function makeAlert(overrides: Partial<AlertView> = {}): AlertView {
  return {
    id: "alert-1",
    status: "OPEN",
    severity: "CRITICAL",
    category: "APPLICATION",
    source: "ec-backend",
    eventName: "latency.spike",
    occurredOn: "2026-06-21T00:00:00.000Z",
    classification: { type: "unknown", confidence: null },
    report: makeReport(),
    feedback: null,
    correctFeedbackCount: 0,
    occurrenceCount: 1,
    createdAt: "2026-06-21T00:00:00.000Z",
    updatedAt: "2026-06-21T00:00:00.000Z",
    ...overrides,
  };
}

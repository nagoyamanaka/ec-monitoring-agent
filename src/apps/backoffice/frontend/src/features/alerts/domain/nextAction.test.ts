import { describe, it, expect } from "vitest";
import { nextAction } from "./nextAction";
import type { AlertView, AlertClassificationView } from "./AlertView";
import type { InvestigationReportView } from "./InvestigationReportView";

const baseReport: InvestigationReportView = {
  summary: "要約",
  confidence: 0.9,
  severity: "WARNING",
  investigationSteps: [],
  suggestedActions: [],
  suggestedPatternName: "pattern",
  reviewStatus: "PENDING_REVIEW",
  investigatedAt: "2026-07-09T00:00:00.000Z",
  isFallback: false,
  remediable: false,
  relatedAlerts: [],
};

function makeAlert(overrides: {
  classification?: AlertClassificationView;
  report?: InvestigationReportView | null;
}): AlertView {
  return {
    id: "a1",
    status: "OPEN",
    severity: "WARNING",
    category: "APPLICATION",
    source: "ec",
    eventName: "ec.payment.timeout",
    occurredOn: "2026-07-09",
    classification: overrides.classification ?? {
      type: "unknown",
      confidence: null,
    },
    report: overrides.report ?? null,
    feedback: null,
    correctFeedbackCount: 0,
    occurrenceCount: 1,
    securityFindings: [],
    detectionDetail: null,
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  };
}

describe("nextAction", () => {
  it("他責ルート（escalation あり）は暫定回避手順を escalation origin で昇格する", () => {
    const report: InvestigationReportView = {
      ...baseReport,
      escalation: {
        team: "vendor",
        owner: "oncall",
        contact: "#v",
        reason: "外部要因",
        interimWorkaround: "リトライ間隔を延ばす",
        severityRationale: "high",
        evidenceBundle: [],
      },
    };
    expect(nextAction(makeAlert({ report }))).toEqual({
      text: "リトライ間隔を延ばす",
      origin: "escalation",
    });
  });

  it("自責ルート（suggestedActions あり・escalation なし）は remediation origin で手順を出す", () => {
    const report: InvestigationReportView = {
      ...baseReport,
      suggestedActions: [{ text: "max_connections を戻す" }],
      remediable: true,
    };
    expect(nextAction(makeAlert({ report }))).toEqual({
      origin: "remediation",
      steps: [{ text: "max_connections を戻す" }],
      remediable: true,
    });
  });

  it("SIMILARITY 既知（レポートなし）は resolvedNote を memory origin で昇格する", () => {
    const classification: AlertClassificationView = {
      type: "known",
      source: "SIMILARITY",
      patternId: "similar:ri-1",
      patternName: "類似既知",
      confidence: 0.7,
      matchedConditions: [],
      resolvedNote: "接続プール上限を拡張して復旧",
    };
    expect(nextAction(makeAlert({ classification }))).toEqual({
      text: "接続プール上限を拡張して復旧",
      origin: "memory",
    });
  });

  it("EXACT_MATCH 既知も resolvedNote（既知パターンの suggestedAction）を memory origin で出す", () => {
    const classification: AlertClassificationView = {
      type: "known",
      source: "EXACT_MATCH",
      patternId: "PAYMENT_TIMEOUT",
      patternName: "決済タイムアウト",
      confidence: 1,
      matchedConditions: [],
      resolvedNote: "決済サービスのステータスを確認し、注文を手動で再処理してください。",
    };
    expect(nextAction(makeAlert({ classification }))?.origin).toBe("memory");
  });

  it("resolvedNote 無しの既知・未知は null（次のアクションを捏造しない）", () => {
    const known: AlertClassificationView = {
      type: "known",
      source: "EXACT_MATCH",
      patternId: "P",
      patternName: "既知",
      confidence: 1,
      matchedConditions: [],
    };
    expect(nextAction(makeAlert({ classification: known }))).toBeNull();
    expect(nextAction(makeAlert({}))).toBeNull();
  });

  it("escalation は自責より優先（両方あっても暫定回避手順を出す）", () => {
    const report: InvestigationReportView = {
      ...baseReport,
      suggestedActions: [{ text: "コード修正" }],
      escalation: {
        team: "vendor",
        owner: "oncall",
        contact: "#v",
        reason: "外部要因",
        interimWorkaround: "一次対応",
        severityRationale: "high",
        evidenceBundle: [],
      },
    };
    expect(nextAction(makeAlert({ report }))?.origin).toBe("escalation");
  });
});

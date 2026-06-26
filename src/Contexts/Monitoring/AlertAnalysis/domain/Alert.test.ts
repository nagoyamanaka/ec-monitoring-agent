import { describe, it, expect } from "vitest";
import { Alert } from "./Alert.js";
import { AlertId } from "./AlertId.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { ClassificationConfidence, KnownAlertClassification } from "./AlertClassification.js";
import { ClassificationRuleKind } from "./classification/ClassificationRuleKind.js";
import { MonitoringEvent } from "../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../Shared/domain/MonitoringEventCategory.js";
import { InvestigationReport } from "./InvestigationReport.js";
import { ReviewStatus } from "./ReviewStatus.js";
import { Uuid } from "../../../Shared/domain/value-object/Uuid.js";

const testEvent = new MonitoringEvent({
  eventId: Uuid.random().value,
  eventName: "ec.payment.timeout",
  aggregateId: "payment-001",
  occurredOn: new Date("2026-01-01T00:00:00Z"),
  payload: { orderId: "order-001", customerId: "customer-001", amount: 5000 },
  category: MonitoringEventCategory.application(),
  severity: AlertSeverity.critical(),
  source: "payment",
});

const knownClassification: KnownAlertClassification = {
  type: "known",
  source: ClassificationRuleKind.EXACT_MATCH,
  patternId: "pattern-001",
  patternName: "PAYMENT_TIMEOUT",
  severity: AlertSeverity.critical(),
  confidence: ClassificationConfidence.certain(),
  matchedConditions: [
    { field: "eventName", expectedValue: "ec.payment.timeout", actualValue: "ec.payment.timeout" },
  ],
  unmatchedConditions: [],
};

const testReport = new InvestigationReport({
  summary: "決済タイムアウトが発生しました",
  confidence: 0.9,
  severity: AlertSeverity.critical(),
  investigationSteps: ["ログを確認", "タイムアウト値を確認"],
  suggestedActions: ["タイムアウト値を延長してください"],
  suggestedPatternName: "PAYMENT_TIMEOUT",
  reviewStatus: ReviewStatus.pendingReview(),
  investigatedAt: new Date("2026-01-01T00:01:00Z"),
  isFallback: false,
});

describe("Alert.createFromKnownPattern()", () => {
  it("statusがOPEN、severityが分類のseverityになる", () => {
    const alert = Alert.createFromKnownPattern({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
      classification: knownClassification,
    });

    expect(alert.status.isOpen()).toBe(true);
    expect(alert.severity.isCritical()).toBe(true);
    expect(alert.classification).toBe(knownClassification);
    expect(alert.investigationReport).toBeNull();
    expect(alert.correctFeedbackCount).toBe(0);
  });
});

describe("Alert.createAsUnknown()", () => {
  it("statusがANALYZING、severityはソース観測値を引き継ぐ", () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    });

    expect(alert.status.isAnalyzing()).toBe(true);
    // 分類は未知でも、ソース（ingest 境界）が付与した severity を初期値に使う。
    expect(alert.severity.value).toBe(testEvent.severity.value);
    expect(alert.classification).toEqual({ type: "unknown", confidence: null });
    expect(alert.investigationReport).toBeNull();
  });
});

describe("Alert.attachInvestigationReport()", () => {
  it("新しいAlertを返し、レポートのseverityで上書き、statusがOPENになる", () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    });

    const updated = alert.attachInvestigationReport(testReport);

    expect(updated.status.isOpen()).toBe(true);
    expect(updated.severity.isCritical()).toBe(true);
    expect(updated.investigationReport).toBe(testReport);
  });

  it("元のAlertは変更されない", () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    });

    alert.attachInvestigationReport(testReport);

    expect(alert.status.isAnalyzing()).toBe(true);
    expect(alert.investigationReport).toBeNull();
  });
});

describe("Alert.submitFeedback()", () => {
  it("isCorrect=trueで新しいAlertを返し、correctFeedbackCountが増加し、reviewStatusがAPPROVEDになる", () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    }).attachInvestigationReport(testReport);

    const updated = alert.submitFeedback({ isCorrect: true, operatorNote: "正解です" });

    expect(updated.correctFeedbackCount).toBe(1);
    expect(updated.investigationReport?.reviewStatus.isApproved()).toBe(true);
    expect(updated.feedback).toEqual({ isCorrect: true, operatorNote: "正解です" });
  });

  it("isCorrect=falseでcorrectFeedbackCountは増加せず、reviewStatusがREJECTEDになる", () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    }).attachInvestigationReport(testReport);

    const updated = alert.submitFeedback({ isCorrect: false });

    expect(updated.correctFeedbackCount).toBe(0);
    expect(updated.investigationReport?.reviewStatus.isRejected()).toBe(true);
  });

  it("investigationReportがない場合でもエラーにならない", () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    });

    const updated = alert.submitFeedback({ isCorrect: true });

    expect(updated.correctFeedbackCount).toBe(1);
    expect(updated.investigationReport).toBeNull();
  });

  it("元のAlertは変更されない", () => {
    const alert = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    }).attachInvestigationReport(testReport);

    alert.submitFeedback({ isCorrect: true });

    expect(alert.correctFeedbackCount).toBe(0);
    expect(alert.investigationReport?.reviewStatus.isPendingReview()).toBe(true);
  });

  it("再レビューで承認→却下→承認に遷移できる（feedback と reviewStatus が上書きされる）", () => {
    const base = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    }).attachInvestigationReport(testReport);

    // 承認（誤承認のつもり）
    const approved = base.submitFeedback({ isCorrect: true });
    expect(approved.feedback?.isCorrect).toBe(true);
    expect(approved.investigationReport?.reviewStatus.isApproved()).toBe(true);

    // 却下し直し（誤承認の訂正）
    const rejected = approved.submitFeedback({
      isCorrect: false,
      operatorNote: "誤承認だった",
    });
    expect(rejected.feedback).toEqual({
      isCorrect: false,
      operatorNote: "誤承認だった",
    });
    expect(rejected.investigationReport?.reviewStatus.isRejected()).toBe(true);

    // フィードバック後に正しくなったので再承認
    const reapproved = rejected.submitFeedback({ isCorrect: true });
    expect(reapproved.feedback?.isCorrect).toBe(true);
    expect(reapproved.investigationReport?.reviewStatus.isApproved()).toBe(true);
  });
});

describe("Alert toPrimitives/fromPrimitives", () => {
  it("既知パターンのAlertがラウンドトリップできる", () => {
    const original = Alert.createFromKnownPattern({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
      classification: knownClassification,
    });

    const restored = Alert.fromPrimitives(original.toPrimitives());

    expect(restored.id.value).toBe(original.id.value);
    expect(restored.status.isOpen()).toBe(true);
    expect(restored.severity.isCritical()).toBe(true);
    expect(restored.classification.type).toBe("known");
    if (restored.classification.type === "known") {
      expect(restored.classification.confidence.value).toBe(1.0);
      expect(restored.classification.patternName).toBe("PAYMENT_TIMEOUT");
    }
  });

  it("investigationReport付きのAlertがラウンドトリップできる", () => {
    const original = Alert.createAsUnknown({
      id: new AlertId(Uuid.random().value),
      monitoringEvent: testEvent,
    }).attachInvestigationReport(testReport);

    const restored = Alert.fromPrimitives(original.toPrimitives());

    expect(restored.investigationReport?.summary).toBe(testReport.summary);
    expect(restored.investigationReport?.reviewStatus.isPendingReview()).toBe(true);
    expect(restored.investigationReport?.investigatedAt.toISOString()).toBe(
      testReport.investigatedAt.toISOString(),
    );
  });
});

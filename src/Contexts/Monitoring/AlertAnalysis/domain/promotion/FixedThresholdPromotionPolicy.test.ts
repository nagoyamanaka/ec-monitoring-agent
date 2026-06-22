import { describe, it, expect } from "vitest";
import { FixedThresholdPromotionPolicy } from "./FixedThresholdPromotionPolicy.js";
import { Alert } from "../Alert.js";
import { AlertId } from "../AlertId.js";
import { InvestigationReport } from "../InvestigationReport.js";
import { ReviewStatus } from "../ReviewStatus.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
} from "../AlertClassification.js";
import { ClassificationRuleKind } from "../classification/ClassificationRuleKind.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";
const THRESHOLD = 3;

const makeEvent = () =>
  new MonitoringEvent({
    eventId: "evt-001",
    eventName: "ec.some.unknown_event",
    aggregateId: "agg-1",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.pending(),
    source: "unknown",
  });

const makeReport = (isFallback = false) =>
  new InvestigationReport({
    summary: "DB コネクションが枯渇していました",
    confidence: 0.9,
    severity: AlertSeverity.critical(),
    investigationSteps: ["接続数を確認"],
    suggestedActions: ["プールサイズを増やす"],
    suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:01:00.000Z"),
    isFallback,
  });

const makeKnownClassification = (): KnownAlertClassification => ({
  type: "known",
  source: ClassificationRuleKind.EXACT_MATCH,
  patternId: "pattern-1",
  patternName: "PAYMENT_TIMEOUT",
  severity: AlertSeverity.critical(),
  confidence: ClassificationConfidence.certain(),
  matchedConditions: [],
  unmatchedConditions: [],
});

// 指定回数だけ正解フィードバックを積んだ Alert を作る
const withCorrectFeedback = (base: Alert, count: number): Alert => {
  let alert = base;
  for (let i = 0; i < count; i++) {
    alert = alert.submitFeedback({ isCorrect: true });
  }
  return alert;
};

const unknownAlertWithReport = (report: InvestigationReport | null) => {
  const base = Alert.createAsUnknown({
    id: new AlertId(ALERT_ID),
    monitoringEvent: makeEvent(),
  });
  return report ? base.attachInvestigationReport(report) : base;
};

describe("FixedThresholdPromotionPolicy", () => {
  const policy = new FixedThresholdPromotionPolicy(THRESHOLD);

  it("回数がしきい値未満なら昇格しない", () => {
    const alert = withCorrectFeedback(
      unknownAlertWithReport(makeReport()),
      THRESHOLD - 1,
    );
    expect(policy.shouldPromote(alert)).toBe(false);
  });

  it("未知＋レポート有でしきい値到達なら昇格する", () => {
    const alert = withCorrectFeedback(
      unknownAlertWithReport(makeReport()),
      THRESHOLD,
    );
    expect(policy.shouldPromote(alert)).toBe(true);
  });

  it("しきい値到達でも既知分類なら昇格しない", () => {
    const base = Alert.createFromKnownPattern({
      id: new AlertId(ALERT_ID),
      monitoringEvent: makeEvent(),
      classification: makeKnownClassification(),
    }).attachInvestigationReport(makeReport());
    const alert = withCorrectFeedback(base, THRESHOLD);
    expect(policy.shouldPromote(alert)).toBe(false);
  });

  it("しきい値到達でも fallback レポートなら昇格しない", () => {
    const alert = withCorrectFeedback(
      unknownAlertWithReport(makeReport(true)),
      THRESHOLD,
    );
    expect(policy.shouldPromote(alert)).toBe(false);
  });

  it("しきい値到達でもレポート無なら昇格しない", () => {
    const alert = withCorrectFeedback(unknownAlertWithReport(null), THRESHOLD);
    expect(policy.shouldPromote(alert)).toBe(false);
  });
});

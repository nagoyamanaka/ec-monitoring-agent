import { describe, it, expect } from "vitest";
import { EvidenceWeightedPromotionPolicy } from "./EvidenceWeightedPromotionPolicy.js";
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

const makeReport = (params: { confidence?: number; isFallback?: boolean } = {}) =>
  new InvestigationReport({
    summary: "DB コネクションが枯渇していました",
    confidence: params.confidence ?? 0.5,
    severity: AlertSeverity.critical(),
    investigationSteps: ["接続数を確認"],
    suggestedActions: ["プールサイズを増やす"],
    suggestedPatternName: "DB_CONNECTION_EXHAUSTION",
    reviewStatus: ReviewStatus.pendingReview(),
    investigatedAt: new Date("2026-01-01T00:01:00.000Z"),
    isFallback: params.isFallback ?? false,
  });

const makeKnownClassification = (
  source: ClassificationRuleKind = ClassificationRuleKind.EXACT_MATCH,
): KnownAlertClassification => ({
  type: "known",
  source,
  patternId: "pattern-1",
  patternName: "PAYMENT_TIMEOUT",
  severity: AlertSeverity.critical(),
  confidence: ClassificationConfidence.certain(),
  matchedConditions: [],
  unmatchedConditions: [],
});

const withCorrectFeedback = (base: Alert, count: number): Alert => {
  let alert = base;
  for (let i = 0; i < count; i++) {
    alert = alert.submitFeedback({ isCorrect: true });
  }
  return alert;
};

const unknownAlertWith = (
  report: InvestigationReport | null,
  feedbackCount: number,
): Alert => {
  const base = Alert.createAsUnknown({
    id: new AlertId(ALERT_ID),
    monitoringEvent: makeEvent(),
  });
  const withReport = report ? base.attachInvestigationReport(report) : base;
  return withCorrectFeedback(withReport, feedbackCount);
};

describe("EvidenceWeightedPromotionPolicy", () => {
  const policy = new EvidenceWeightedPromotionPolicy();

  describe("後方互換（証拠加点ゼロ＝FixedThreshold(3) と一致）", () => {
    it("低確度では correctFeedbackCount=3 で昇格する", () => {
      const alert = unknownAlertWith(makeReport({ confidence: 0.5 }), 3);
      expect(policy.shouldPromote(alert)).toBe(true);
    });

    it("低確度では correctFeedbackCount=2 では昇格しない", () => {
      const alert = unknownAlertWith(makeReport({ confidence: 0.5 }), 2);
      expect(policy.shouldPromote(alert)).toBe(false);
    });
  });

  describe("確度による加重（似ている度が高いほど少ない確認で結晶化）", () => {
    it("高確度(>=0.8)+2回 なら昇格する（0.8+0.3=1.1>=1.0）", () => {
      const alert = unknownAlertWith(makeReport({ confidence: 0.85 }), 2);
      expect(policy.shouldPromote(alert)).toBe(true);
    });

    it("高確度でも1回(0.4+0.3=0.7)では昇格しない", () => {
      const alert = unknownAlertWith(makeReport({ confidence: 0.85 }), 1);
      expect(policy.shouldPromote(alert)).toBe(false);
    });

    it("中確度(>=0.6)+2回(0.8+0.1=0.9)では昇格しない", () => {
      const alert = unknownAlertWith(makeReport({ confidence: 0.6 }), 2);
      expect(policy.shouldPromote(alert)).toBe(false);
    });

    it("中確度(>=0.6)+3回(1.2+0.1)では昇格する", () => {
      const alert = unknownAlertWith(makeReport({ confidence: 0.6 }), 3);
      expect(policy.shouldPromote(alert)).toBe(true);
    });
  });

  describe("ハード除外（加点に関わらず昇格しない）", () => {
    it("fallback レポートは高確度・多数フィードバックでも昇格しない", () => {
      const alert = unknownAlertWith(
        makeReport({ confidence: 1.0, isFallback: true }),
        5,
      );
      expect(policy.shouldPromote(alert)).toBe(false);
    });

    it("レポート無は昇格しない", () => {
      const alert = unknownAlertWith(null, 5);
      expect(policy.shouldPromote(alert)).toBe(false);
    });

    it("完全一致（EXACT_MATCH）既知分類は昇格しない", () => {
      const base = Alert.createFromKnownPattern({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeEvent(),
        classification: makeKnownClassification(),
      }).attachInvestigationReport(makeReport({ confidence: 1.0 }));
      const alert = withCorrectFeedback(base, 5);
      expect(policy.shouldPromote(alert)).toBe(false);
    });
  });

  describe("類似既知（SIMILARITY）＝準・既知の昇格（完全一致へ登る学習ループ）", () => {
    const similarityAlertWith = (
      report: InvestigationReport | null,
      feedbackCount: number,
    ): Alert => {
      const base = Alert.createFromKnownPattern({
        id: new AlertId(ALERT_ID),
        monitoringEvent: makeEvent(),
        classification: makeKnownClassification(
          ClassificationRuleKind.SIMILARITY,
        ),
      });
      const withReport = report ? base.attachInvestigationReport(report) : base;
      return withCorrectFeedback(withReport, feedbackCount);
    };

    it("レポート有なら未知と同じ加重で昇格する（低確度+3回）", () => {
      const alert = similarityAlertWith(makeReport({ confidence: 0.5 }), 3);
      expect(policy.shouldPromote(alert)).toBe(true);
    });

    it("承認1回では昇格しない（0.4+高確度0.3=0.7<1.0＝手動昇格の領分）", () => {
      const alert = similarityAlertWith(makeReport({ confidence: 0.85 }), 1);
      expect(policy.shouldPromote(alert)).toBe(false);
    });

    it("レポート無は昇格しない（結晶化の材料が無い）", () => {
      const alert = similarityAlertWith(null, 5);
      expect(policy.shouldPromote(alert)).toBe(false);
    });
  });

  describe("重みの注入（env 非依存・テストは明示注入）", () => {
    it("promoteThreshold を下げると 1 回でも昇格する", () => {
      const lenient = new EvidenceWeightedPromotionPolicy({
        promoteThreshold: 0.4,
      });
      const alert = unknownAlertWith(makeReport({ confidence: 0.5 }), 1);
      expect(lenient.shouldPromote(alert)).toBe(true);
    });
  });
});

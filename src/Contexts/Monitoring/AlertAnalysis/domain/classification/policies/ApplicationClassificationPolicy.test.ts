import { describe, it, expect } from "vitest";
import { ApplicationClassificationPolicy } from "./ApplicationClassificationPolicy.js";
import { ClassificationRule } from "../ClassificationRule.js";
import { ClassificationRuleKind } from "../ClassificationRuleKind.js";
import { ClassificationRuleSorter } from "../ClassificationRuleSorter.js";
import {
  ClassificationConfidence,
  KnownAlertClassification,
} from "../../AlertClassification.js";
import { MonitoringEvent } from "../../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../../Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../../../../Shared/domain/AlertSeverity.js";

class StubRule implements ClassificationRule {
  constructor(
    readonly kind: ClassificationRuleKind,
    private readonly result: KnownAlertClassification | null,
  ) {}
  async classify(): Promise<KnownAlertClassification | null> {
    return this.result;
  }
}

function classification(patternName: string): KnownAlertClassification {
  return {
    type: "known",
    patternId: `id-${patternName}`,
    patternName,
    severity: AlertSeverity.warning(),
    confidence: ClassificationConfidence.certain(),
    matchedConditions: [],
    unmatchedConditions: [],
  };
}

function appEvent(): MonitoringEvent {
  return new MonitoringEvent({
    eventId: "evt-001",
    eventName: "ec.payment.timeout",
    aggregateId: "agg-001",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.warning(),
    source: "test",
  });
}

const sorter = new ClassificationRuleSorter();

describe("ApplicationClassificationPolicy", () => {
  describe("supports()", () => {
    it("APPLICATION category を扱う", () => {
      const policy = new ApplicationClassificationPolicy([], sorter);
      expect(policy.supports(appEvent())).toBe(true);
    });

    it("APPLICATION 以外は扱わない", () => {
      const policy = new ApplicationClassificationPolicy([], sorter);
      const securityEvent = new MonitoringEvent({
        eventId: "evt-001",
        eventName: "security.vulnerability_detected",
        aggregateId: "agg-001",
        occurredOn: new Date("2026-01-01T00:00:00.000Z"),
        payload: {},
        category: MonitoringEventCategory.security(),
        severity: AlertSeverity.critical(),
        source: "test",
      });
      expect(policy.supports(securityEvent)).toBe(false);
    });
  });

  describe("classify()", () => {
    it("発火した Rule の分類結果を matched:true で返す", async () => {
      const policy = new ApplicationClassificationPolicy(
        [new StubRule(ClassificationRuleKind.EXACT_MATCH, classification("EXACT"))],
        sorter,
      );

      const result = await policy.classify(appEvent());

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.classification.patternName).toBe("EXACT");
      }
    });

    it("全 Rule が棄権(null)なら matched:false", async () => {
      const policy = new ApplicationClassificationPolicy(
        [new StubRule(ClassificationRuleKind.EXACT_MATCH, null)],
        sorter,
      );

      const result = await policy.classify(appEvent());

      expect(result.matched).toBe(false);
    });

    it("配列順に関わらず高優先 kind(EXACT_MATCH) の Rule が優先される", async () => {
      // SIMILARITY を先に渡しても、Sorter が EXACT_MATCH を先頭に並べ替える
      const policy = new ApplicationClassificationPolicy(
        [
          new StubRule(ClassificationRuleKind.SIMILARITY, classification("SIMILAR")),
          new StubRule(ClassificationRuleKind.EXACT_MATCH, classification("EXACT")),
        ],
        sorter,
      );

      const result = await policy.classify(appEvent());

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.classification.patternName).toBe("EXACT");
      }
    });

    it("高優先 Rule が棄権したら次の優先 Rule にフォールバックする", async () => {
      const policy = new ApplicationClassificationPolicy(
        [
          new StubRule(ClassificationRuleKind.SIMILARITY, classification("SIMILAR")),
          new StubRule(ClassificationRuleKind.EXACT_MATCH, null),
        ],
        sorter,
      );

      const result = await policy.classify(appEvent());

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.classification.patternName).toBe("SIMILAR");
      }
    });
  });
});

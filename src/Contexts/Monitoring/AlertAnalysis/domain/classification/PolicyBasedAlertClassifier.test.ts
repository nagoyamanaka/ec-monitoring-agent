import { describe, it, expect } from "vitest";
import { PolicyBasedAlertClassifier } from "./PolicyBasedAlertClassifier.js";
import { ClassificationRuleSorter } from "./ClassificationRuleSorter.js";
import { ApplicationClassificationPolicy } from "./policies/ApplicationClassificationPolicy.js";
import { KnownPatternRule } from "./rules/KnownPatternRule.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { KnownErrorPattern } from "../KnownErrorPattern.js";
import { AlertSeverity } from "../AlertSeverity.js";
import { InMemoryKnownErrorPatternRepository } from "../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";

const paymentTimeoutPattern = KnownErrorPattern.create({
  id: "pattern-001",
  name: "PAYMENT_TIMEOUT",
  description: "",
  eventNamePattern: "ec.payment.timeout",
  payloadConditions: [],
  severity: AlertSeverity.critical(),
  suggestedAction: "",
});

// 本番の composition root（step4-3 DI）が行う組み立てをテスト内で再現する。
function buildClassifier(): PolicyBasedAlertClassifier {
  const repository = new InMemoryKnownErrorPatternRepository([
    paymentTimeoutPattern,
  ]);
  const sorter = new ClassificationRuleSorter();
  return new PolicyBasedAlertClassifier([
    new ApplicationClassificationPolicy(
      [new KnownPatternRule(repository)],
      sorter,
    ),
  ]);
}

function makeEvent(params: {
  eventName: string;
  category?: MonitoringEventCategory;
}): MonitoringEvent {
  return new MonitoringEvent({
    eventId: "evt-001",
    eventName: params.eventName,
    aggregateId: "agg-001",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: params.category ?? MonitoringEventCategory.application(),
    source: "test",
  });
}

describe("PolicyBasedAlertClassifier", () => {
  it("APPLICATION イベントが既知パターンに一致したら matched:true を返す", async () => {
    const result = await buildClassifier().classify(
      makeEvent({ eventName: "ec.payment.timeout" }),
    );

    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.classification.patternName).toBe("PAYMENT_TIMEOUT");
    }
  });

  it("既知パターンに一致しない場合は matched:false を返す", async () => {
    const result = await buildClassifier().classify(
      makeEvent({ eventName: "ec.unknown.event" }),
    );

    expect(result.matched).toBe(false);
  });

  it("担当 Policy が無い category は matched:false を返す", async () => {
    const result = await buildClassifier().classify(
      makeEvent({
        eventName: "ec.payment.timeout",
        category: MonitoringEventCategory.security(),
      }),
    );

    expect(result.matched).toBe(false);
  });
});

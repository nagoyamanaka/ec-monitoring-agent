import { describe, it, expect } from "vitest";
import { ExactMatchFallbackPolicy } from "./ExactMatchFallbackPolicy.js";
import { KnownPatternRule } from "../rules/KnownPatternRule.js";
import { MonitoringEvent } from "../../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../../Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../../../../Shared/domain/AlertSeverity.js";
import { KnownErrorPattern } from "../../KnownErrorPattern.js";
import { InMemoryKnownErrorPatternRepository } from "../../../infrastructure/persistence/InMemoryKnownErrorPatternRepository.js";

// 昇格（結晶化）が生成するのと同型の eventName のみ一致パターン（payloadConditions 空）。
const promotedInfraPattern = KnownErrorPattern.create({
  id: "pattern-infra-001",
  name: "PROMOTED_GCP.MONITORING.CRITICAL_LOG_ENTRIES",
  description: "",
  eventNamePattern: "gcp.monitoring.critical_log_entries",
  payloadConditions: [],
  severity: AlertSeverity.critical(),
  suggestedAction: "",
});

function buildPolicy(): ExactMatchFallbackPolicy {
  const repository = new InMemoryKnownErrorPatternRepository([
    promotedInfraPattern,
  ]);
  return new ExactMatchFallbackPolicy(new KnownPatternRule(repository));
}

function makeEvent(params: {
  eventName: string;
  category: MonitoringEventCategory;
}): MonitoringEvent {
  return new MonitoringEvent({
    eventId: "evt-001",
    eventName: params.eventName,
    aggregateId: "agg-001",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: {},
    category: params.category,
    severity: AlertSeverity.critical(),
    source: "test",
  });
}

describe("ExactMatchFallbackPolicy", () => {
  describe("supports()", () => {
    it("全 category を扱う（受け皿なので棄権しない）", () => {
      const policy = buildPolicy();
      for (const category of [
        MonitoringEventCategory.application(),
        MonitoringEventCategory.infrastructure(),
        MonitoringEventCategory.capacity(),
        MonitoringEventCategory.security(),
      ]) {
        expect(
          policy.supports(
            makeEvent({ eventName: "any.event", category }),
          ),
        ).toBe(true);
      }
    });
  });

  describe("classify()", () => {
    it("INFRASTRUCTURE イベントでも昇格済みパターンに完全一致すれば known を返す", async () => {
      const result = await buildPolicy().classify(
        makeEvent({
          eventName: "gcp.monitoring.critical_log_entries",
          category: MonitoringEventCategory.infrastructure(),
        }),
      );

      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.classification.patternName).toBe(
          "PROMOTED_GCP.MONITORING.CRITICAL_LOG_ENTRIES",
        );
      }
    });

    it("一致するパターンが無ければ matched:false（未知のまま）", async () => {
      const result = await buildPolicy().classify(
        makeEvent({
          eventName: "gcp.monitoring.unseen_condition",
          category: MonitoringEventCategory.infrastructure(),
        }),
      );

      expect(result.matched).toBe(false);
    });
  });
});

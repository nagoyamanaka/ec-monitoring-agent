import { describe, it, expect } from "vitest";
import { KnownPatternRule } from "./KnownPatternRule.js";
import { MonitoringEvent } from "../../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../../Shared/domain/MonitoringEventCategory.js";
import { KnownErrorPattern } from "../../KnownErrorPattern.js";
import { KnownErrorPatternRepository } from "../../KnownErrorPatternRepository.js";
import { AlertSeverity } from "../../AlertSeverity.js";

class StubKnownErrorPatternRepository implements KnownErrorPatternRepository {
  constructor(private readonly patterns: KnownErrorPattern[]) {}
  async findAll(): Promise<KnownErrorPattern[]> {
    return this.patterns;
  }
  async findById(id: string): Promise<KnownErrorPattern | null> {
    return this.patterns.find((p) => p.id === id) ?? null;
  }
  async save(): Promise<void> {}
}

function makeRule(patterns: KnownErrorPattern[]): KnownPatternRule {
  return new KnownPatternRule(new StubKnownErrorPatternRepository(patterns));
}

function makeEvent(params: {
  eventName: string;
  payload?: Record<string, unknown>;
}): MonitoringEvent {
  return new MonitoringEvent({
    eventId: "evt-001",
    eventName: params.eventName,
    aggregateId: "agg-001",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    payload: params.payload ?? {},
    category: MonitoringEventCategory.application(),
    source: "test",
  });
}

function makePattern(params: {
  id?: string;
  name: string;
  eventNamePattern: string;
  payloadConditions?: { field: string; value: unknown }[];
  severity?: AlertSeverity;
}): KnownErrorPattern {
  return KnownErrorPattern.create({
    id: params.id ?? "pattern-001",
    name: params.name,
    description: "",
    eventNamePattern: params.eventNamePattern,
    payloadConditions: params.payloadConditions ?? [],
    severity: params.severity ?? AlertSeverity.warning(),
    suggestedAction: "",
  });
}

describe("KnownPatternRule", () => {
  describe("classify()", () => {
    it("eventName一致・payloadConditions空の場合にマッチする", async () => {
      const event = makeEvent({ eventName: "ec.payment.timeout" });
      const rule = makeRule([
        makePattern({
          name: "PAYMENT_TIMEOUT",
          eventNamePattern: "ec.payment.timeout",
          payloadConditions: [],
          severity: AlertSeverity.critical(),
        }),
      ]);

      const result = await rule.classify(event);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("known");
      expect(result?.patternName).toBe("PAYMENT_TIMEOUT");
      expect(result?.confidence.value).toBe(1.0);
      expect(result?.unmatchedConditions).toHaveLength(0);
    });

    it("eventName一致・payloadConditions一致の場合にマッチする", async () => {
      const event = makeEvent({
        eventName: "ec.inventory.reservation_failed",
        payload: { reason: "INSUFFICIENT_STOCK" },
      });
      const rule = makeRule([
        makePattern({
          name: "INVENTORY_INSUFFICIENT",
          eventNamePattern: "ec.inventory.reservation_failed",
          payloadConditions: [{ field: "reason", value: "INSUFFICIENT_STOCK" }],
        }),
      ]);

      const result = await rule.classify(event);

      expect(result).not.toBeNull();
      expect(result?.patternName).toBe("INVENTORY_INSUFFICIENT");
      expect(result?.matchedConditions).toHaveLength(2);
      expect(result?.matchedConditions[0]).toEqual({
        field: "eventName",
        expectedValue: "ec.inventory.reservation_failed",
        actualValue: "ec.inventory.reservation_failed",
      });
      expect(result?.matchedConditions[1]).toEqual({
        field: "payload.reason",
        expectedValue: "INSUFFICIENT_STOCK",
        actualValue: "INSUFFICIENT_STOCK",
      });
    });

    it("eventName不一致の場合はnullを返す", async () => {
      const event = makeEvent({ eventName: "ec.order.placed" });
      const rule = makeRule([
        makePattern({ name: "PAYMENT_TIMEOUT", eventNamePattern: "ec.payment.timeout" }),
      ]);

      expect(await rule.classify(event)).toBeNull();
    });

    it("eventName一致・payloadConditions不一致の場合はnullを返す", async () => {
      const event = makeEvent({
        eventName: "ec.inventory.reservation_failed",
        payload: { reason: "OTHER_REASON" },
      });
      const rule = makeRule([
        makePattern({
          name: "INVENTORY_INSUFFICIENT",
          eventNamePattern: "ec.inventory.reservation_failed",
          payloadConditions: [{ field: "reason", value: "INSUFFICIENT_STOCK" }],
        }),
      ]);

      expect(await rule.classify(event)).toBeNull();
    });

    it("パターンが空の場合はnullを返す", async () => {
      const event = makeEvent({ eventName: "ec.payment.timeout" });
      const rule = makeRule([]);

      expect(await rule.classify(event)).toBeNull();
    });

    it("first-match: 複数パターンがある場合は先頭のパターンを優先する", async () => {
      const event = makeEvent({
        eventName: "ec.inventory.reservation_failed",
        payload: { reason: "INSUFFICIENT_STOCK" },
      });
      const rule = makeRule([
        makePattern({
          id: "first",
          name: "INVENTORY_INSUFFICIENT",
          eventNamePattern: "ec.inventory.reservation_failed",
          payloadConditions: [{ field: "reason", value: "INSUFFICIENT_STOCK" }],
        }),
        makePattern({
          id: "second",
          name: "INVENTORY_CONCURRENT_CONFLICT",
          eventNamePattern: "ec.inventory.reservation_failed",
          payloadConditions: [{ field: "reason", value: "INSUFFICIENT_STOCK" }],
        }),
      ]);

      const result = await rule.classify(event);

      expect(result?.patternId).toBe("first");
      expect(result?.patternName).toBe("INVENTORY_INSUFFICIENT");
    });

    it("eventName不一致のパターンをスキップして次のパターンにマッチする", async () => {
      const event = makeEvent({ eventName: "ec.payment.timeout" });
      const rule = makeRule([
        makePattern({
          id: "non-matching",
          name: "INVENTORY_INSUFFICIENT",
          eventNamePattern: "ec.inventory.reservation_failed",
        }),
        makePattern({
          id: "matching",
          name: "PAYMENT_TIMEOUT",
          eventNamePattern: "ec.payment.timeout",
          severity: AlertSeverity.critical(),
        }),
      ]);

      const result = await rule.classify(event);

      expect(result?.patternId).toBe("matching");
    });

    it("matchedのseverityはパターンのseverityを引き継ぐ", async () => {
      const event = makeEvent({ eventName: "ec.payment.timeout" });
      const rule = makeRule([
        makePattern({
          name: "PAYMENT_TIMEOUT",
          eventNamePattern: "ec.payment.timeout",
          severity: AlertSeverity.critical(),
        }),
      ]);

      const result = await rule.classify(event);

      expect(result?.severity.isCritical()).toBe(true);
    });
  });
});

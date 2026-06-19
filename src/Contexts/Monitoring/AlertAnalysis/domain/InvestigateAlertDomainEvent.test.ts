import { describe, it, expect } from "vitest";
import { InvestigateAlertDomainEvent } from "./InvestigateAlertDomainEvent.js";
import { MonitoringEventPrimitives } from "../../Shared/domain/MonitoringEvent.js";

const ALERT_ID = "550e8400-e29b-41d4-a716-446655440000";
const EVENT_ID = "550e8400-e29b-41d4-a716-446655440001";

const MONITORING_EVENT: MonitoringEventPrimitives = {
  eventId: "550e8400-e29b-41d4-a716-446655440002",
  eventName: "ec.payment.timeout",
  aggregateId: "payment-attempt-1",
  occurredOn: "2026-01-01T00:00:00.000Z",
  payload: { orderId: "order-1", customerId: "cust-1", amount: 5000 },
  category: "APPLICATION",
  source: "payment",
};

describe("InvestigateAlertDomainEvent", () => {
  describe("EVENT_NAME", () => {
    it('"monitoring.alert.investigate_requested" である', () => {
      expect(InvestigateAlertDomainEvent.EVENT_NAME).toBe(
        "monitoring.alert.investigate_requested",
      );
    });
  });

  describe("toPrimitives() / fromPrimitives()", () => {
    it("ラウンドトリップで同じ値が復元される", () => {
      const occurredOn = new Date("2026-01-01T00:00:00.000Z");
      const original = new InvestigateAlertDomainEvent({
        alertId: ALERT_ID,
        monitoringEvent: MONITORING_EVENT,
        eventId: EVENT_ID,
        occurredOn,
      });

      const restored = InvestigateAlertDomainEvent.fromPrimitives({
        aggregateId: original.aggregateId,
        eventId: original.eventId,
        occurredOn: original.occurredOn,
        attributes: original.toPrimitives(),
      });

      expect(restored.aggregateId).toBe(ALERT_ID);
      expect(restored.eventId).toBe(EVENT_ID);
      expect(restored.occurredOn).toEqual(occurredOn);
      expect(restored.eventName).toBe(InvestigateAlertDomainEvent.EVENT_NAME);
      expect(restored.monitoringEvent).toEqual(MONITORING_EVENT);
    });
  });
});

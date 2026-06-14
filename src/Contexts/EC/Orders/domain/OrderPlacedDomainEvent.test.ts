import { describe, it, expect } from "vitest";
import { OrderPlacedDomainEvent } from "./OrderPlacedDomainEvent.js";

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440001";
const EVENT_ID = "550e8400-e29b-41d4-a716-446655440002";
const ITEMS = [{ productId: "prod-1", quantity: 2, unitPrice: 300 }];

describe("OrderPlacedDomainEvent", () => {
  describe("EVENT_NAME", () => {
    it('"ec.order.placed" である', () => {
      expect(OrderPlacedDomainEvent.EVENT_NAME).toBe("ec.order.placed");
    });
  });

  describe("toPrimitives() / fromPrimitives()", () => {
    it("ラウンドトリップで同じ値が復元される", () => {
      const occurredOn = new Date("2024-01-01T00:00:00.000Z");
      const original = new OrderPlacedDomainEvent({
        orderId: ORDER_ID,
        customerId: CUSTOMER_ID,
        items: ITEMS,
        subtotalAmount: 600,
        eventId: EVENT_ID,
        occurredOn,
      });

      const restored = OrderPlacedDomainEvent.fromPrimitives({
        aggregateId: original.aggregateId,
        eventId: original.eventId,
        occurredOn: original.occurredOn,
        attributes: original.toPrimitives(),
      });

      expect(restored.aggregateId).toBe(ORDER_ID);
      expect(restored.customerId).toBe(CUSTOMER_ID);
      expect(restored.items).toEqual(ITEMS);
      expect(restored.subtotalAmount).toBe(600);
      expect(restored.eventId).toBe(EVENT_ID);
    });
  });
});

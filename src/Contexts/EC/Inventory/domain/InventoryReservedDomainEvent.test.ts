import { describe, it, expect } from "vitest";
import { InventoryReservedDomainEvent } from "./InventoryReservedDomainEvent.js";

const PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440001";
const EVENT_ID = "550e8400-e29b-41d4-a716-446655440002";

describe("InventoryReservedDomainEvent", () => {
  describe("EVENT_NAME", () => {
    it('"ec.inventory.reserved" である', () => {
      expect(InventoryReservedDomainEvent.EVENT_NAME).toBe(
        "ec.inventory.reserved"
      );
    });
  });

  describe("toPrimitives() / fromPrimitives()", () => {
    it("ラウンドトリップで同じ値が復元される", () => {
      const occurredOn = new Date("2024-01-01T00:00:00.000Z");
      const original = new InventoryReservedDomainEvent({
        productId: PRODUCT_ID,
        orderId: ORDER_ID,
        reservedQuantity: 3,
        remainingStock: 7,
        eventId: EVENT_ID,
        occurredOn,
      });

      const restored = InventoryReservedDomainEvent.fromPrimitives({
        aggregateId: original.aggregateId,
        eventId: original.eventId,
        occurredOn: original.occurredOn,
        attributes: original.toPrimitives(),
      });

      expect(restored.aggregateId).toBe(PRODUCT_ID);
      expect(restored.orderId).toBe(ORDER_ID);
      expect(restored.reservedQuantity).toBe(3);
      expect(restored.remainingStock).toBe(7);
      expect(restored.eventId).toBe(EVENT_ID);
    });
  });
});

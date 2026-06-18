import { describe, it, expect } from "vitest";
import { InventoryReservationFailedDomainEvent } from "./InventoryReservationFailedDomainEvent.js";
import {
  InventoryFailureReason,
  InventoryFailureReasons,
} from "./InventoryFailureReason.js";

const PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440001";
const EVENT_ID = "550e8400-e29b-41d4-a716-446655440002";
const RESERVED_PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440003";

describe("InventoryReservationFailedDomainEvent", () => {
  describe("EVENT_NAME", () => {
    it('"ec.inventory.reservation_failed" である', () => {
      expect(InventoryReservationFailedDomainEvent.EVENT_NAME).toBe(
        "ec.inventory.reservation_failed"
      );
    });
  });

  describe("toPrimitives() / fromPrimitives()", () => {
    it("ラウンドトリップで同じ値が復元される (INSUFFICIENT_STOCK)", () => {
      const occurredOn = new Date("2024-01-01T00:00:00.000Z");
      const original = new InventoryReservationFailedDomainEvent({
        productId: PRODUCT_ID,
        orderId: ORDER_ID,
        requestedQuantity: 5,
        currentStock: 2,
        reason: InventoryFailureReason.insufficientStock(),
        eventId: EVENT_ID,
        occurredOn,
      });

      const restored = InventoryReservationFailedDomainEvent.fromPrimitives({
        aggregateId: original.aggregateId,
        eventId: original.eventId,
        occurredOn: original.occurredOn,
        attributes: original.toPrimitives(),
      });

      expect(restored.aggregateId).toBe(PRODUCT_ID);
      expect(restored.orderId).toBe(ORDER_ID);
      expect(restored.requestedQuantity).toBe(5);
      expect(restored.currentStock).toBe(2);
      expect(restored.reason.value).toBe(InventoryFailureReasons.INSUFFICIENT_STOCK);
      expect(restored.eventId).toBe(EVENT_ID);
    });

    it("ラウンドトリップで同じ値が復元される (CONCURRENT_CONFLICT)", () => {
      const occurredOn = new Date("2024-01-01T00:00:00.000Z");
      const original = new InventoryReservationFailedDomainEvent({
        productId: PRODUCT_ID,
        orderId: ORDER_ID,
        requestedQuantity: 1,
        currentStock: 0,
        reason: InventoryFailureReason.concurrentConflict(),
        eventId: EVENT_ID,
        occurredOn,
      });

      const restored = InventoryReservationFailedDomainEvent.fromPrimitives({
        aggregateId: original.aggregateId,
        eventId: original.eventId,
        occurredOn: original.occurredOn,
        attributes: original.toPrimitives(),
      });

      expect(restored.reason.isConcurrentConflict()).toBe(true);
    });

    it("reservedProductIds がラウンドトリップで復元される", () => {
      const occurredOn = new Date("2024-01-01T00:00:00.000Z");
      const original = new InventoryReservationFailedDomainEvent({
        productId: PRODUCT_ID,
        orderId: ORDER_ID,
        requestedQuantity: 1,
        currentStock: 0,
        reason: InventoryFailureReason.concurrentConflict(),
        reservedProductIds: [RESERVED_PRODUCT_ID],
        eventId: EVENT_ID,
        occurredOn,
      });

      const restored = InventoryReservationFailedDomainEvent.fromPrimitives({
        aggregateId: original.aggregateId,
        eventId: original.eventId,
        occurredOn: original.occurredOn,
        attributes: original.toPrimitives(),
      });

      expect(restored.reservedProductIds).toEqual([RESERVED_PRODUCT_ID]);
    });

    it("reservedProductIds を省略した場合は空配列になる", () => {
      const original = new InventoryReservationFailedDomainEvent({
        productId: PRODUCT_ID,
        orderId: ORDER_ID,
        requestedQuantity: 5,
        currentStock: 2,
        reason: InventoryFailureReason.insufficientStock(),
      });

      expect(original.reservedProductIds).toEqual([]);
    });
  });
});

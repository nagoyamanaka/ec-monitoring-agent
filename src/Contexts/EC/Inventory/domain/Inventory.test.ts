import { describe, it, expect } from "vitest";
import { Inventory } from "./Inventory.js";
import { ProductId } from "./ProductId.js";
import { StockQuantity } from "./StockQuantity.js";
import { InventoryReservedDomainEvent } from "./InventoryReservedDomainEvent.js";
import { InventoryReservationFailedDomainEvent } from "./InventoryReservationFailedDomainEvent.js";
import { InventoryFailureReasons } from "./InventoryFailureReason.js";

const PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440001";

const makeInventory = (stock = 10) =>
  Inventory.initialize({
    productId: new ProductId(PRODUCT_ID),
    initialStock: new StockQuantity(stock),
  });

describe("Inventory", () => {
  describe("initialize()", () => {
    it("指定した在庫数で生成される", () => {
      const inventory = makeInventory(20);
      expect(inventory.stock.value).toBe(20);
      expect(inventory.productId.value).toBe(PRODUCT_ID);
      expect(inventory.version).toBe(0);
    });
  });

  describe("reserve() — 成功ケース", () => {
    it("在庫とバージョンが更新される", () => {
      const inventory = makeInventory(10);
      inventory.reserve(ORDER_ID, 3, {
        success: true,
        remainingStock: 7,
        newVersion: 1,
      });
      expect(inventory.stock.value).toBe(7);
      expect(inventory.version).toBe(1);
    });

    it("InventoryReservedDomainEvent を1件発行する", () => {
      const inventory = makeInventory(10);
      inventory.reserve(ORDER_ID, 3, {
        success: true,
        remainingStock: 7,
        newVersion: 1,
      });
      const events = inventory.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(InventoryReservedDomainEvent);
    });

    it("発行イベントに正しい予約情報が含まれる", () => {
      const inventory = makeInventory(10);
      inventory.reserve(ORDER_ID, 3, {
        success: true,
        remainingStock: 7,
        newVersion: 1,
      });
      const event = inventory.pullDomainEvents()[0] as InventoryReservedDomainEvent;
      expect(event.aggregateId).toBe(PRODUCT_ID);
      expect(event.orderId).toBe(ORDER_ID);
      expect(event.reservedQuantity).toBe(3);
      expect(event.remainingStock).toBe(7);
    });
  });

  describe("reserve() — 失敗ケース（INSUFFICIENT_STOCK）", () => {
    it("在庫は変化しない", () => {
      const inventory = makeInventory(2);
      inventory.reserve(ORDER_ID, 5, {
        success: false,
        reason: InventoryFailureReasons.INSUFFICIENT_STOCK,
      });
      expect(inventory.stock.value).toBe(2);
    });

    it("InventoryReservationFailedDomainEvent を1件発行する", () => {
      const inventory = makeInventory(2);
      inventory.reserve(ORDER_ID, 5, {
        success: false,
        reason: InventoryFailureReasons.INSUFFICIENT_STOCK,
      });
      const events = inventory.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(InventoryReservationFailedDomainEvent);
    });

    it("発行イベントに失敗理由と在庫情報が含まれる", () => {
      const inventory = makeInventory(2);
      inventory.reserve(ORDER_ID, 5, {
        success: false,
        reason: InventoryFailureReasons.INSUFFICIENT_STOCK,
      });
      const event = inventory.pullDomainEvents()[0] as InventoryReservationFailedDomainEvent;
      expect(event.reason.isInsufficientStock()).toBe(true);
      expect(event.requestedQuantity).toBe(5);
      expect(event.currentStock).toBe(2);
      expect(event.orderId).toBe(ORDER_ID);
    });
  });

  describe("reserve() — 失敗ケース（CONCURRENT_CONFLICT）", () => {
    it("InventoryReservationFailedDomainEvent を発行し reason が CONCURRENT_CONFLICT である", () => {
      const inventory = makeInventory(10);
      inventory.reserve(ORDER_ID, 3, {
        success: false,
        reason: InventoryFailureReasons.CONCURRENT_CONFLICT,
      });
      const event = inventory.pullDomainEvents()[0] as InventoryReservationFailedDomainEvent;
      expect(event.reason.isConcurrentConflict()).toBe(true);
    });
  });

  describe("fromPrimitives() / toPrimitives()", () => {
    it("ラウンドトリップで同じ値が復元される", () => {
      const original = makeInventory(15);
      const primitives = original.toPrimitives() as {
        productId: string;
        stock: number;
        version: number;
        updatedAt: Date;
      };
      const restored = Inventory.fromPrimitives(primitives);
      expect(restored.productId.value).toBe(PRODUCT_ID);
      expect(restored.stock.value).toBe(15);
      expect(restored.version).toBe(0);
    });
  });
});

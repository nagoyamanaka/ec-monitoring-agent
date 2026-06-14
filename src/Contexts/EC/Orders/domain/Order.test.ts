import { describe, it, expect } from "vitest";
import { Order, InvalidOrderStatusTransitionError } from "./Order.js";
import { OrderId } from "./OrderId.js";
import { CustomerId } from "./CustomerId.js";
import { OrderItems } from "./OrderItems.js";
import { OrderItem } from "./OrderItem.js";
import { OrderPlacedDomainEvent } from "./OrderPlacedDomainEvent.js";
import { OrderStatusValues } from "./OrderStatus.js";

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440001";

const makeOrderParams = () => ({
  id: new OrderId(ORDER_ID),
  customerId: new CustomerId(CUSTOMER_ID),
  items: new OrderItems([new OrderItem("prod-1", 2, 500)]),
});

describe("Order", () => {
  describe("place()", () => {
    it("PENDING ステータスの Order を生成する", () => {
      const order = Order.place(makeOrderParams());
      expect(order.status.value).toBe(OrderStatusValues.PENDING);
    });

    it("OrderPlacedDomainEvent を1件発行する", () => {
      const order = Order.place(makeOrderParams());
      const events = order.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OrderPlacedDomainEvent);
    });

    it("発行イベントに正しいorderIdとcustomerIdが含まれる", () => {
      const order = Order.place(makeOrderParams());
      const event = order.pullDomainEvents()[0] as OrderPlacedDomainEvent;
      expect(event.aggregateId).toBe(ORDER_ID);
      expect(event.customerId).toBe(CUSTOMER_ID);
    });

    it("発行イベントに subtotalAmount が含まれる", () => {
      const order = Order.place(makeOrderParams());
      const event = order.pullDomainEvents()[0] as OrderPlacedDomainEvent;
      expect(event.subtotalAmount).toBe(1000); // 2 * 500
    });

    it("pullDomainEvents() 後にイベントキューが空になる", () => {
      const order = Order.place(makeOrderParams());
      order.pullDomainEvents();
      expect(order.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe("confirmInventory()", () => {
    it("PENDING → CONFIRMED に遷移する", () => {
      const order = Order.place(makeOrderParams());
      order.pullDomainEvents();
      order.confirmInventory();
      expect(order.status.value).toBe(OrderStatusValues.CONFIRMED);
    });

    it("CONFIRMED の Order に呼ぶと InvalidOrderStatusTransitionError をthrowする", () => {
      const order = Order.place(makeOrderParams());
      order.pullDomainEvents();
      order.confirmInventory();
      expect(() => order.confirmInventory()).toThrow(InvalidOrderStatusTransitionError);
    });

    it("FAILED の Order に呼ぶと InvalidOrderStatusTransitionError をthrowする", () => {
      const order = Order.place(makeOrderParams());
      order.pullDomainEvents();
      order.failInventory();
      expect(() => order.confirmInventory()).toThrow(InvalidOrderStatusTransitionError);
    });
  });

  describe("failInventory()", () => {
    it("PENDING → FAILED に遷移する", () => {
      const order = Order.place(makeOrderParams());
      order.pullDomainEvents();
      order.failInventory();
      expect(order.status.value).toBe(OrderStatusValues.FAILED);
    });

    it("CONFIRMED の Order に呼ぶと InvalidOrderStatusTransitionError をthrowする", () => {
      const order = Order.place(makeOrderParams());
      order.pullDomainEvents();
      order.confirmInventory();
      expect(() => order.failInventory()).toThrow(InvalidOrderStatusTransitionError);
    });
  });

  describe("fromPrimitives() / toPrimitives()", () => {
    it("ラウンドトリップで同じ値が復元される", () => {
      const original = Order.place(makeOrderParams());
      original.pullDomainEvents();
      const primitives = original.toPrimitives() as {
        id: string;
        customerId: string;
        items: { productId: string; quantity: number; unitPrice: number }[];
        status: string;
        createdAt: Date;
        updatedAt: Date;
      };
      const restored = Order.fromPrimitives(primitives);
      expect(restored.id.value).toBe(ORDER_ID);
      expect(restored.customerId.value).toBe(CUSTOMER_ID);
      expect(restored.status.value).toBe(OrderStatusValues.PENDING);
      expect(restored.items.value).toHaveLength(1);
    });
  });
});

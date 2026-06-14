import { describe, it, expect } from "vitest";
import { OrderItem } from "./OrderItem.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("OrderItem", () => {
  describe("constructor", () => {
    it("有効な値で構築できる", () => {
      const item = new OrderItem("prod-1", 2, 500);
      expect(item.productId).toBe("prod-1");
      expect(item.quantity).toBe(2);
      expect(item.unitPrice).toBe(500);
    });

    it("quantity が 0 以下で InvalidArgumentError をthrowする", () => {
      expect(() => new OrderItem("prod-1", 0, 500)).toThrow(InvalidArgumentError);
      expect(() => new OrderItem("prod-1", -1, 500)).toThrow(InvalidArgumentError);
    });

    it("unitPrice が負でInvalidArgumentError をthrowする", () => {
      expect(() => new OrderItem("prod-1", 1, -1)).toThrow(InvalidArgumentError);
    });

    it("unitPrice が 0 は許容する", () => {
      expect(() => new OrderItem("prod-1", 1, 0)).not.toThrow();
    });
  });

  describe("subtotal()", () => {
    it("quantity * unitPrice を返す", () => {
      const item = new OrderItem("prod-1", 3, 200);
      expect(item.subtotal()).toBe(600);
    });
  });

  describe("toPrimitives() / fromPrimitives()", () => {
    it("ラウンドトリップで同じ値が復元される", () => {
      const item = new OrderItem("prod-1", 2, 500);
      const restored = OrderItem.fromPrimitives(item.toPrimitives());
      expect(restored.productId).toBe(item.productId);
      expect(restored.quantity).toBe(item.quantity);
      expect(restored.unitPrice).toBe(item.unitPrice);
    });
  });
});

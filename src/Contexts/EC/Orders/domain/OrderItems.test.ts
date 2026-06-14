import { describe, it, expect } from "vitest";
import { OrderItem } from "./OrderItem.js";
import { OrderItems } from "./OrderItems.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

const makeItem = (unitPrice = 100, quantity = 1) =>
  new OrderItem("prod-1", quantity, unitPrice);

describe("OrderItems", () => {
  describe("constructor", () => {
    it("1件以上で構築できる", () => {
      expect(() => new OrderItems([makeItem()])).not.toThrow();
    });

    it("空配列で InvalidArgumentError をthrowする", () => {
      expect(() => new OrderItems([])).toThrow(InvalidArgumentError);
    });
  });

  describe("subtotalAmount()", () => {
    it("全アイテムの小計合計を返す", () => {
      const items = new OrderItems([
        new OrderItem("prod-1", 2, 300),
        new OrderItem("prod-2", 1, 500),
      ]);
      expect(items.subtotalAmount().value).toBe(1100);
    });

    it("1件の場合はそのアイテムの小計と一致する", () => {
      const items = new OrderItems([new OrderItem("prod-1", 3, 200)]);
      expect(items.subtotalAmount().value).toBe(600);
    });
  });

  describe("toPrimitives() / fromPrimitives()", () => {
    it("ラウンドトリップで同じ値が復元される", () => {
      const original = new OrderItems([
        new OrderItem("prod-1", 2, 300),
        new OrderItem("prod-2", 1, 500),
      ]);
      const restored = OrderItems.fromPrimitives(original.toPrimitives());
      expect(restored.value).toHaveLength(2);
      expect(restored.value[0].productId).toBe("prod-1");
      expect(restored.value[1].unitPrice).toBe(500);
    });
  });
});

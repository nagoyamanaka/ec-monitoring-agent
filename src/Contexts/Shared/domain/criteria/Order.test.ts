import { describe, it, expect } from "vitest";
import { Order } from "./Order.js";
import { OrderTypes } from "./OrderType.js";
import { InvalidArgumentError } from "../errors/InvalidArgumentError.js";

describe("Order", () => {
  describe("Order.fromValues()", () => {
    it("orderByが未指定の場合Order.none()を返す", () => {
      const order = Order.fromValues(undefined);
      expect(order.orderType.value).toBe(OrderTypes.NONE);
      expect(order.hasOrder()).toBe(false);
    });

    it("orderByのみ指定の場合デフォルトでASCになる", () => {
      const order = Order.fromValues("name");
      expect(order.orderBy.value).toBe("name");
      expect(order.orderType.value).toBe(OrderTypes.ASC);
    });

    it("orderByとorderTypeを両方指定できる", () => {
      const order = Order.fromValues("name", "desc");
      expect(order.orderBy.value).toBe("name");
      expect(order.orderType.value).toBe(OrderTypes.DESC);
    });
  });

  describe("Order.none()", () => {
    it("NONEタイプのOrderを生成する", () => {
      const order = Order.none();
      expect(order.orderType.value).toBe(OrderTypes.NONE);
    });

    it("hasOrder()がfalseを返す", () => {
      expect(Order.none().hasOrder()).toBe(false);
    });
  });

  describe("Order.asc()", () => {
    it("指定フィールドのASCソートを生成する", () => {
      const order = Order.asc("createdAt");
      expect(order.orderBy.value).toBe("createdAt");
      expect(order.orderType.value).toBe(OrderTypes.ASC);
    });

    it("hasOrder()がtrueを返す", () => {
      expect(Order.asc("createdAt").hasOrder()).toBe(true);
    });
  });

  describe("Order.desc()", () => {
    it("指定フィールドのDESCソートを生成する", () => {
      const order = Order.desc("updatedAt");
      expect(order.orderBy.value).toBe("updatedAt");
      expect(order.orderType.value).toBe(OrderTypes.DESC);
    });

    it("hasOrder()がtrueを返す", () => {
      expect(Order.desc("updatedAt").hasOrder()).toBe(true);
    });
  });
});

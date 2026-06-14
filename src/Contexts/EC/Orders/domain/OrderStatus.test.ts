import { describe, it, expect } from "vitest";
import { OrderStatus, OrderStatusValues } from "./OrderStatus.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("OrderStatus", () => {
  describe("ファクトリメソッド", () => {
    it("pending() が PENDING を返す", () => {
      expect(OrderStatus.pending().value).toBe(OrderStatusValues.PENDING);
    });

    it("confirmed() が CONFIRMED を返す", () => {
      expect(OrderStatus.confirmed().value).toBe(OrderStatusValues.CONFIRMED);
    });

    it("failed() が FAILED を返す", () => {
      expect(OrderStatus.failed().value).toBe(OrderStatusValues.FAILED);
    });
  });

  describe("fromString()", () => {
    it("有効な文字列から生成できる", () => {
      expect(OrderStatus.fromString("PENDING").value).toBe(
        OrderStatusValues.PENDING,
      );
    });

    it("無効な文字列で InvalidArgumentError をthrowする", () => {
      expect(() => OrderStatus.fromString("UNKNOWN")).toThrow(
        InvalidArgumentError,
      );
    });
  });

  describe("状態判定メソッド", () => {
    it("isPending() は PENDING のみ true", () => {
      expect(OrderStatus.pending().isPending()).toBe(true);
      expect(OrderStatus.confirmed().isPending()).toBe(false);
      expect(OrderStatus.failed().isPending()).toBe(false);
    });

    it("isConfirmed() は CONFIRMED のみ true", () => {
      expect(OrderStatus.confirmed().isConfirmed()).toBe(true);
      expect(OrderStatus.pending().isConfirmed()).toBe(false);
      expect(OrderStatus.failed().isConfirmed()).toBe(false);
    });

    it("isFailed() は FAILED のみ true", () => {
      expect(OrderStatus.failed().isFailed()).toBe(true);
      expect(OrderStatus.pending().isFailed()).toBe(false);
      expect(OrderStatus.confirmed().isFailed()).toBe(false);
    });
  });
});

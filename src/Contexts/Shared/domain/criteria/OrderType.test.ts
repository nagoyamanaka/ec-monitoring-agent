import { describe, it, expect } from "vitest";
import { OrderType, OrderTypes } from "./OrderType.js";
import { InvalidArgumentError } from "../errors/InvalidArgumentError.js";

describe("OrderType", () => {
  describe("fromValue()", () => {
    it("有効なOrderTypes文字列からインスタンスを生成する", () => {
      expect(OrderType.fromValue("asc").value).toBe(OrderTypes.ASC);
      expect(OrderType.fromValue("desc").value).toBe(OrderTypes.DESC);
      expect(OrderType.fromValue("none").value).toBe(OrderTypes.NONE);
    });

    it("無効なOrderTypes文字列でInvalidArgumentErrorをthrowする", () => {
      expect(() => OrderType.fromValue("INVALID")).toThrow(InvalidArgumentError);
      expect(() => OrderType.fromValue("")).toThrow(InvalidArgumentError);
    });
  });

  describe("isNone()", () => {
    it("NONE のとき true を返す", () => {
      expect(OrderType.fromValue("none").isNone()).toBe(true);
    });

    it("ASC / DESC のとき false を返す", () => {
      expect(OrderType.fromValue("asc").isNone()).toBe(false);
      expect(OrderType.fromValue("desc").isNone()).toBe(false);
    });
  });

  describe("isAsc()", () => {
    it("ASC のとき true を返す", () => {
      expect(OrderType.fromValue("asc").isAsc()).toBe(true);
    });

    it("DESC / NONE のとき false を返す", () => {
      expect(OrderType.fromValue("desc").isAsc()).toBe(false);
      expect(OrderType.fromValue("none").isAsc()).toBe(false);
    });
  });

  describe("constructor", () => {
    it("無効なEnum値を直接渡すとInvalidArgumentErrorをthrowする", () => {
      expect(
        () => new OrderType("INVALID" as OrderTypes),
      ).toThrow(InvalidArgumentError);
    });
  });
});

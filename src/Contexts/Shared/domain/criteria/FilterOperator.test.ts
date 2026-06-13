import { describe, it, expect } from "vitest";
import { FilterOperator, Operator } from "./FilterOperator.js";
import { InvalidArgumentError } from "../errors/InvalidArgumentError.js";

describe("FilterOperator", () => {
  describe("fromValue()", () => {
    it("有効なOperator文字列からインスタンスを生成する", () => {
      expect(FilterOperator.fromValue("=").value).toBe(Operator.EQUAL);
      expect(FilterOperator.fromValue("!=").value).toBe(Operator.NOT_EQUAL);
      expect(FilterOperator.fromValue(">").value).toBe(Operator.GT);
      expect(FilterOperator.fromValue("<").value).toBe(Operator.LT);
      expect(FilterOperator.fromValue("CONTAINS").value).toBe(Operator.CONTAINS);
      expect(FilterOperator.fromValue("NOT_CONTAINS").value).toBe(Operator.NOT_CONTAINS);
    });

    it("無効なOperator文字列でInvalidArgumentErrorをthrowする", () => {
      expect(() => FilterOperator.fromValue("INVALID")).toThrow(InvalidArgumentError);
      expect(() => FilterOperator.fromValue("")).toThrow(InvalidArgumentError);
    });
  });

  describe("isPositive()", () => {
    it("EQUAL / GT / LT / CONTAINS はpositiveである", () => {
      expect(FilterOperator.fromValue("=").isPositive()).toBe(true);
      expect(FilterOperator.fromValue(">").isPositive()).toBe(true);
      expect(FilterOperator.fromValue("<").isPositive()).toBe(true);
      expect(FilterOperator.fromValue("CONTAINS").isPositive()).toBe(true);
    });

    it("NOT_EQUAL / NOT_CONTAINS はpositiveではない", () => {
      expect(FilterOperator.fromValue("!=").isPositive()).toBe(false);
      expect(FilterOperator.fromValue("NOT_CONTAINS").isPositive()).toBe(false);
    });
  });

  describe("静的ファクトリメソッド", () => {
    it("equal() は EQUAL を返す", () => {
      expect(FilterOperator.equal().value).toBe(Operator.EQUAL);
    });

    it("notEqual() は NOT_EQUAL を返す", () => {
      expect(FilterOperator.notEqual().value).toBe(Operator.NOT_EQUAL);
    });

    it("gt() は GT を返す", () => {
      expect(FilterOperator.gt().value).toBe(Operator.GT);
    });

    it("lt() は LT を返す", () => {
      expect(FilterOperator.lt().value).toBe(Operator.LT);
    });

    it("contains() は CONTAINS を返す", () => {
      expect(FilterOperator.contains().value).toBe(Operator.CONTAINS);
    });

    it("notContains() は NOT_CONTAINS を返す", () => {
      expect(FilterOperator.notContains().value).toBe(Operator.NOT_CONTAINS);
    });
  });

  describe("constructor", () => {
    it("無効なEnum値を直接渡すとInvalidArgumentErrorをthrowする", () => {
      expect(
        () => new FilterOperator("INVALID" as Operator),
      ).toThrow(InvalidArgumentError);
    });
  });
});

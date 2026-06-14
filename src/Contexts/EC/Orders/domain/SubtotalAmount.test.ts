import { describe, it, expect } from "vitest";
import { SubtotalAmount } from "./SubtotalAmount.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("SubtotalAmount", () => {
  describe("constructor", () => {
    it("0以上の値で構築できる", () => {
      expect(new SubtotalAmount(0).value).toBe(0);
      expect(new SubtotalAmount(1500).value).toBe(1500);
    });

    it("負の値で InvalidArgumentError をthrowする", () => {
      expect(() => new SubtotalAmount(-1)).toThrow(InvalidArgumentError);
    });
  });

  describe("equals()", () => {
    it("同じ値同士でtrueを返す", () => {
      expect(new SubtotalAmount(500).equals(new SubtotalAmount(500))).toBe(true);
    });

    it("異なる値同士でfalseを返す", () => {
      expect(new SubtotalAmount(500).equals(new SubtotalAmount(600))).toBe(false);
    });
  });
});

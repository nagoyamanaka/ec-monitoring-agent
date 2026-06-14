import { describe, it, expect } from "vitest";
import { StockQuantity } from "./StockQuantity.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("StockQuantity", () => {
  describe("constructor", () => {
    it("0以上の値で構築できる", () => {
      expect(new StockQuantity(0).value).toBe(0);
      expect(new StockQuantity(100).value).toBe(100);
    });

    it("負の値で InvalidArgumentError をthrowする", () => {
      expect(() => new StockQuantity(-1)).toThrow(InvalidArgumentError);
    });
  });

  describe("hasEnoughStock()", () => {
    it("在庫数以下のquantityで true を返す", () => {
      expect(new StockQuantity(10).hasEnoughStock(10)).toBe(true);
      expect(new StockQuantity(10).hasEnoughStock(5)).toBe(true);
    });

    it("在庫数を超えるquantityで false を返す", () => {
      expect(new StockQuantity(5).hasEnoughStock(6)).toBe(false);
    });

    it("在庫0のとき常に false を返す", () => {
      expect(new StockQuantity(0).hasEnoughStock(1)).toBe(false);
    });
  });

  describe("decrement()", () => {
    it("指定量を減算した新しい StockQuantity を返す", () => {
      const result = new StockQuantity(10).decrement(3);
      expect(result.value).toBe(7);
    });

    it("0になるまで減算できる", () => {
      const result = new StockQuantity(5).decrement(5);
      expect(result.value).toBe(0);
    });

    it("0未満になる場合 InvalidArgumentError をthrowする", () => {
      expect(() => new StockQuantity(3).decrement(4)).toThrow(InvalidArgumentError);
    });
  });

  describe("increment()", () => {
    it("指定量を加算した新しい StockQuantity を返す", () => {
      const result = new StockQuantity(5).increment(3);
      expect(result.value).toBe(8);
    });

    it("0在庫からも加算できる", () => {
      const result = new StockQuantity(0).increment(10);
      expect(result.value).toBe(10);
    });
  });
});

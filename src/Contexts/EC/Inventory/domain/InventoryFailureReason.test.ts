import { describe, it, expect } from "vitest";
import {
  InventoryFailureReason,
  InventoryFailureReasons,
} from "./InventoryFailureReason.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("InventoryFailureReason", () => {
  describe("ファクトリメソッド", () => {
    it("insufficientStock()でINSUFFICIENT_STOCKが生成される", () => {
      expect(InventoryFailureReason.insufficientStock().value).toBe(
        InventoryFailureReasons.INSUFFICIENT_STOCK,
      );
    });

    it("concurrentConflict()でCONCURRENT_CONFLICTが生成される", () => {
      expect(InventoryFailureReason.concurrentConflict().value).toBe(
        InventoryFailureReasons.CONCURRENT_CONFLICT,
      );
    });
  });

  describe("fromString()", () => {
    it("有効な文字列から生成できる", () => {
      expect(
        InventoryFailureReason.fromString("INSUFFICIENT_STOCK").value,
      ).toBe(InventoryFailureReasons.INSUFFICIENT_STOCK);

      expect(
        InventoryFailureReason.fromString("CONCURRENT_CONFLICT").value,
      ).toBe(InventoryFailureReasons.CONCURRENT_CONFLICT);
    });

    it("不正な値でInvalidArgumentErrorをthrowする", () => {
      expect(() => InventoryFailureReason.fromString("INVALID")).toThrow(
        InvalidArgumentError,
      );
    });
  });

  describe("判定メソッド", () => {
    it("isInsufficientStock()が正しく動作する", () => {
      expect(
        InventoryFailureReason.insufficientStock().isInsufficientStock(),
      ).toBe(true);
      expect(
        InventoryFailureReason.concurrentConflict().isInsufficientStock(),
      ).toBe(false);
    });

    it("isConcurrentConflict()が正しく動作する", () => {
      expect(
        InventoryFailureReason.concurrentConflict().isConcurrentConflict(),
      ).toBe(true);
      expect(
        InventoryFailureReason.insufficientStock().isConcurrentConflict(),
      ).toBe(false);
    });
  });
});

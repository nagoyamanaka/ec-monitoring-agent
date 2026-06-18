import { describe, it, expect } from "vitest";
import { AlertStatus, AlertStatuses } from "./AlertStatus.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("AlertStatus", () => {
  describe("ファクトリメソッド", () => {
    it("open()でOPENが生成される", () => {
      expect(AlertStatus.open().value).toBe(AlertStatuses.OPEN);
    });

    it("analyzing()でANALYZINGが生成される", () => {
      expect(AlertStatus.analyzing().value).toBe(AlertStatuses.ANALYZING);
    });

    it("resolved()でRESOLVEDが生成される", () => {
      expect(AlertStatus.resolved().value).toBe(AlertStatuses.RESOLVED);
    });
  });

  describe("fromString()", () => {
    it("有効な文字列からインスタンスを生成する", () => {
      expect(AlertStatus.fromString("OPEN").value).toBe(AlertStatuses.OPEN);
      expect(AlertStatus.fromString("ANALYZING").value).toBe(AlertStatuses.ANALYZING);
      expect(AlertStatus.fromString("RESOLVED").value).toBe(AlertStatuses.RESOLVED);
    });

    it("不正な値でInvalidArgumentErrorをthrowする", () => {
      expect(() => AlertStatus.fromString("INVALID")).toThrow(InvalidArgumentError);
      expect(() => AlertStatus.fromString("")).toThrow(InvalidArgumentError);
    });
  });

  describe("判定メソッド", () => {
    it("isOpen()が正しく動作する", () => {
      expect(AlertStatus.open().isOpen()).toBe(true);
      expect(AlertStatus.analyzing().isOpen()).toBe(false);
      expect(AlertStatus.resolved().isOpen()).toBe(false);
    });

    it("isAnalyzing()が正しく動作する", () => {
      expect(AlertStatus.analyzing().isAnalyzing()).toBe(true);
      expect(AlertStatus.open().isAnalyzing()).toBe(false);
      expect(AlertStatus.resolved().isAnalyzing()).toBe(false);
    });

    it("isResolved()が正しく動作する", () => {
      expect(AlertStatus.resolved().isResolved()).toBe(true);
      expect(AlertStatus.open().isResolved()).toBe(false);
      expect(AlertStatus.analyzing().isResolved()).toBe(false);
    });
  });

  describe("constructor", () => {
    it("無効なEnum値を直接渡すとInvalidArgumentErrorをthrowする", () => {
      expect(() => new AlertStatus("INVALID" as AlertStatuses)).toThrow(InvalidArgumentError);
    });
  });
});

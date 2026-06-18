import { describe, it, expect } from "vitest";
import { AlertSeverity, AlertSeverities } from "./AlertSeverity.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("AlertSeverity", () => {
  describe("ファクトリメソッド", () => {
    it("critical()でCRITICALが生成される", () => {
      expect(AlertSeverity.critical().value).toBe(AlertSeverities.CRITICAL);
    });

    it("warning()でWARNINGが生成される", () => {
      expect(AlertSeverity.warning().value).toBe(AlertSeverities.WARNING);
    });

    it("info()でINFOが生成される", () => {
      expect(AlertSeverity.info().value).toBe(AlertSeverities.INFO);
    });
  });

  describe("fromString()", () => {
    it("有効な文字列からインスタンスを生成する", () => {
      expect(AlertSeverity.fromString("CRITICAL").value).toBe(AlertSeverities.CRITICAL);
      expect(AlertSeverity.fromString("WARNING").value).toBe(AlertSeverities.WARNING);
      expect(AlertSeverity.fromString("INFO").value).toBe(AlertSeverities.INFO);
    });

    it("不正な値でInvalidArgumentErrorをthrowする", () => {
      expect(() => AlertSeverity.fromString("INVALID")).toThrow(InvalidArgumentError);
      expect(() => AlertSeverity.fromString("")).toThrow(InvalidArgumentError);
    });
  });

  describe("判定メソッド", () => {
    it("isCritical()が正しく動作する", () => {
      expect(AlertSeverity.critical().isCritical()).toBe(true);
      expect(AlertSeverity.warning().isCritical()).toBe(false);
      expect(AlertSeverity.info().isCritical()).toBe(false);
    });

    it("isWarning()が正しく動作する", () => {
      expect(AlertSeverity.warning().isWarning()).toBe(true);
      expect(AlertSeverity.critical().isWarning()).toBe(false);
      expect(AlertSeverity.info().isWarning()).toBe(false);
    });

    it("isInfo()が正しく動作する", () => {
      expect(AlertSeverity.info().isInfo()).toBe(true);
      expect(AlertSeverity.critical().isInfo()).toBe(false);
      expect(AlertSeverity.warning().isInfo()).toBe(false);
    });
  });

  describe("constructor", () => {
    it("無効なEnum値を直接渡すとInvalidArgumentErrorをthrowする", () => {
      expect(() => new AlertSeverity("INVALID" as AlertSeverities)).toThrow(InvalidArgumentError);
    });
  });
});

import { describe, it, expect } from "vitest";
import { MonitoringEventCategory, MonitoringEventCategories } from "./MonitoringEventCategory.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

describe("MonitoringEventCategory", () => {
  describe("ファクトリメソッド", () => {
    it("application()でAPPLICATIONが生成される", () => {
      expect(MonitoringEventCategory.application().value).toBe(MonitoringEventCategories.APPLICATION);
    });

    it("infrastructure()でINFRASTRUCTUREが生成される", () => {
      expect(MonitoringEventCategory.infrastructure().value).toBe(MonitoringEventCategories.INFRASTRUCTURE);
    });

    it("capacity()でCAPACITYが生成される", () => {
      expect(MonitoringEventCategory.capacity().value).toBe(MonitoringEventCategories.CAPACITY);
    });

    it("security()でSECURITYが生成される", () => {
      expect(MonitoringEventCategory.security().value).toBe(MonitoringEventCategories.SECURITY);
    });
  });

  describe("fromString()", () => {
    it("有効な文字列からインスタンスを生成する", () => {
      expect(MonitoringEventCategory.fromString("APPLICATION").value).toBe(MonitoringEventCategories.APPLICATION);
      expect(MonitoringEventCategory.fromString("INFRASTRUCTURE").value).toBe(MonitoringEventCategories.INFRASTRUCTURE);
      expect(MonitoringEventCategory.fromString("CAPACITY").value).toBe(MonitoringEventCategories.CAPACITY);
      expect(MonitoringEventCategory.fromString("SECURITY").value).toBe(MonitoringEventCategories.SECURITY);
    });

    it("不正な値でInvalidArgumentErrorをthrowする", () => {
      expect(() => MonitoringEventCategory.fromString("INVALID")).toThrow(InvalidArgumentError);
      expect(() => MonitoringEventCategory.fromString("")).toThrow(InvalidArgumentError);
    });
  });

  describe("constructor", () => {
    it("無効なEnum値を直接渡すとInvalidArgumentErrorをthrowする", () => {
      expect(() => new MonitoringEventCategory("INVALID" as MonitoringEventCategories)).toThrow(InvalidArgumentError);
    });
  });
});

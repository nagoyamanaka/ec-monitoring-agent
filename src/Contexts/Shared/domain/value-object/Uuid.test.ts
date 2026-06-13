import { describe, it, expect } from "vitest";
import { Uuid } from "./Uuid.js";
import { InvalidArgumentError } from "../errors/InvalidArgumentError.js";

describe("Uuid", () => {
  describe("constructor", () => {
    it("有効なUUID v4を受け付ける", () => {
      const uuid = new Uuid("550e8400-e29b-41d4-a716-446655440000");
      expect(uuid.value).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("無効な文字列でInvalidArgumentErrorをthrowする", () => {
      expect(() => new Uuid("not-a-uuid")).toThrow(InvalidArgumentError);
    });

    it("空文字でInvalidArgumentErrorをthrowする", () => {
      expect(() => new Uuid("")).toThrow(InvalidArgumentError);
    });

    it("null/undefinedでInvalidArgumentErrorをthrowする", () => {
      expect(() => new Uuid(null as unknown as string)).toThrow(
        InvalidArgumentError,
      );
      expect(() => new Uuid(undefined as unknown as string)).toThrow(
        InvalidArgumentError,
      );
    });
  });

  describe("random()", () => {
    it("UUID v4形式の値を生成する", () => {
      expect(() => Uuid.random()).not.toThrow();
    });

    it("呼び出すたびに異なる値を生成する", () => {
      const a = Uuid.random();
      const b = Uuid.random();
      expect(a.value).not.toBe(b.value);
    });
  });

  describe("equals()", () => {
    it("同じ値同士でtrueを返す", () => {
      const a = new Uuid("550e8400-e29b-41d4-a716-446655440000");
      const b = new Uuid("550e8400-e29b-41d4-a716-446655440000");
      expect(a.equals(b)).toBe(true);
    });

    it("異なる値同士でfalseを返す", () => {
      const a = Uuid.random();
      const b = Uuid.random();
      expect(a.equals(b)).toBe(false);
    });
  });
});

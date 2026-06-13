import { describe, it, expect } from "vitest";
import { Filter } from "./Filter.js";
import { FilterField } from "./FilterField.js";
import { FilterOperator } from "./FilterOperator.js";
import { FilterValue } from "./FilterValue.js";
import { Operator } from "./FilterOperator.js";
import { InvalidArgumentError } from "../errors/InvalidArgumentError.js";

describe("Filter", () => {
  describe("constructor", () => {
    it("field / operator / value を保持する", () => {
      const filter = new Filter(
        new FilterField("status"),
        FilterOperator.equal(),
        new FilterValue("PENDING"),
      );
      expect(filter.field.value).toBe("status");
      expect(filter.operator.value).toBe(Operator.EQUAL);
      expect(filter.value.value).toBe("PENDING");
    });
  });

  describe("fromValues()", () => {
    it("有効なMapからFilterを生成する", () => {
      const map = new Map([
        ["field", "status"],
        ["operator", "="],
        ["value", "PENDING"],
      ]);
      const filter = Filter.fromValues(map);
      expect(filter.field.value).toBe("status");
      expect(filter.operator.value).toBe(Operator.EQUAL);
      expect(filter.value.value).toBe("PENDING");
    });

    it("fieldが欠けている場合InvalidArgumentErrorをthrowする", () => {
      const map = new Map([
        ["operator", "="],
        ["value", "PENDING"],
      ]);
      expect(() => Filter.fromValues(map)).toThrow(InvalidArgumentError);
    });

    it("operatorが欠けている場合InvalidArgumentErrorをthrowする", () => {
      const map = new Map([
        ["field", "status"],
        ["value", "PENDING"],
      ]);
      expect(() => Filter.fromValues(map)).toThrow(InvalidArgumentError);
    });

    it("valueが欠けている場合InvalidArgumentErrorをthrowする", () => {
      const map = new Map([
        ["field", "status"],
        ["operator", "="],
      ]);
      expect(() => Filter.fromValues(map)).toThrow(InvalidArgumentError);
    });
  });
});

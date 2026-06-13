import { describe, it, expect } from "vitest";
import { Filters } from "./Filters.js";

describe("Filters", () => {
  describe("none()", () => {
    it("空のFiltersを返す", () => {
      expect(Filters.none().filters).toHaveLength(0);
    });
  });

  describe("fromValues()", () => {
    it("複数のMapからFiltersを生成する", () => {
      const maps = [
        new Map([
          ["field", "status"],
          ["operator", "="],
          ["value", "PENDING"],
        ]),
        new Map([
          ["field", "customerId"],
          ["operator", "="],
          ["value", "abc"],
        ]),
      ];
      const filters = Filters.fromValues(maps);
      expect(filters.filters).toHaveLength(2);
    });
  });
});

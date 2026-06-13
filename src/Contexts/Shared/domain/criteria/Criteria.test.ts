import { describe, it, expect } from "vitest";
import { Criteria } from "./Criteria.js";
import { Filter } from "./Filter.js";
import { Filters } from "./Filters.js";
import { FilterField } from "./FilterField.js";
import { FilterOperator } from "./FilterOperator.js";
import { FilterValue } from "./FilterValue.js";
import { Order } from "./Order.js";

describe("Criteria", () => {
  describe("Criteria.none()", () => {
    it("フィルタなしのCriteriaを返す", () => {
      expect(Criteria.none().hasFilters()).toBe(false);
    });

    it("ソートなしのCriteriaを返す", () => {
      expect(Criteria.none().order.hasOrder()).toBe(false);
    });

    it("limit/offsetが未定義である", () => {
      const criteria = Criteria.none();
      expect(criteria.limit).toBeUndefined();
      expect(criteria.offset).toBeUndefined();
    });
  });

  describe("hasFilters()", () => {
    it("フィルタが1件以上あればtrueを返す", () => {
      const filter = new Filter(
        new FilterField("status"),
        FilterOperator.equal(),
        new FilterValue("PENDING"),
      );
      const criteria = new Criteria(new Filters([filter]), Order.none());
      expect(criteria.hasFilters()).toBe(true);
    });

    it("Filters.none()ではfalseを返す", () => {
      const criteria = new Criteria(Filters.none(), Order.none());
      expect(criteria.hasFilters()).toBe(false);
    });
  });
});

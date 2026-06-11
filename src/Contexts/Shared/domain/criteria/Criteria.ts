import { Filters } from "./Filters.js";
import { CriteriaOrder } from "./CriteriaOrder.js";

export class Criteria {
  readonly filters: Filters;
  readonly order: CriteriaOrder;
  readonly limit?: number;
  readonly offset?: number;

  constructor(
    filters: Filters,
    order: CriteriaOrder,
    limit?: number,
    offset?: number,
  ) {
    this.filters = filters;
    this.order = order;
    this.limit = limit;
    this.offset = offset;
  }

  static all(): Criteria {
    return new Criteria(Filters.none(), CriteriaOrder.none());
  }

  hasFilters(): boolean {
    return !this.filters.isEmpty();
  }
}

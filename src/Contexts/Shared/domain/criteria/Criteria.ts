import { Filters } from "./Filters.js";
import { Order } from "./Order.js";

export class Criteria {
  readonly filters: Filters;
  readonly order: Order;
  readonly limit?: number;
  readonly offset?: number;

  constructor(filters: Filters, order: Order, limit?: number, offset?: number) {
    this.filters = filters;
    this.order = order;
    this.limit = limit;
    this.offset = offset;
  }

  static all(): Criteria {
    return new Criteria(Filters.none(), Order.none());
  }

  public hasFilters(): boolean {
    return this.filters.filters.length > 0;
  }
}

import { Order } from "../../domain/Order.js";
import { OrderId } from "../../domain/OrderId.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { Filter } from "../../../../Shared/domain/criteria/Filter.js";
import { Operator } from "../../../../Shared/domain/criteria/FilterOperator.js";
import { OrderRepository } from "../../domain/OrderRepository.js";

type Comparable = string | number | Date;

export class InMemoryOrderRepository implements OrderRepository {
  private readonly store = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.store.set(order.id.value, order);
  }

  async findById(id: OrderId): Promise<Order | null> {
    return this.store.get(id.value) ?? null;
  }

  async findByCriteria(criteria: Criteria): Promise<Order[]> {
    let results = Array.from(this.store.values());

    if (criteria.hasFilters()) {
      results = results.filter((order) =>
        criteria.filters.filters.every((filter) =>
          this.matchesFilter(order, filter),
        ),
      );
    }

    if (criteria.order.hasOrder()) {
      const field = criteria.order.orderBy.value;
      const isAsc = criteria.order.orderType.isAsc();
      results.sort((a, b) => {
        const aVal = this.getField(a, field);
        const bVal = this.getField(b, field);
        if (aVal < bVal) return isAsc ? -1 : 1;
        if (aVal > bVal) return isAsc ? 1 : -1;
        return 0;
      });
    }

    const offset = criteria.offset ?? 0;
    results = results.slice(
      offset,
      criteria.limit !== undefined ? offset + criteria.limit : undefined,
    );

    return results;
  }

  private matchesFilter(order: Order, filter: Filter): boolean {
    const fieldValue = this.getField(order, filter.field.value);
    const filterValue = filter.value.value;

    switch (filter.operator.value) {
      case Operator.EQUAL:
        return String(fieldValue) === filterValue;
      case Operator.NOT_EQUAL:
        return String(fieldValue) !== filterValue;
      case Operator.GT:
        return fieldValue > this.coerce(fieldValue, filterValue);
      case Operator.LT:
        return fieldValue < this.coerce(fieldValue, filterValue);
      case Operator.CONTAINS:
        return String(fieldValue).includes(filterValue);
      case Operator.NOT_CONTAINS:
        return !String(fieldValue).includes(filterValue);
      default:
        return true;
    }
  }

  private getField(order: Order, field: string): Comparable {
    const primitives = order.toPrimitives();
    return primitives[field as keyof typeof primitives] as Comparable;
  }

  private coerce(reference: Comparable, value: string): Comparable {
    if (reference instanceof Date) return new Date(value);
    if (typeof reference === "number") return Number(value);
    return value;
  }

  clear(): void {
    this.store.clear();
  }
}

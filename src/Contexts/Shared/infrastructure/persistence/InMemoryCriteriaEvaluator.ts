import { Criteria } from "../../domain/criteria/Criteria.js";
import { Filter } from "../../domain/criteria/Filter.js";
import { Operator } from "../../domain/criteria/FilterOperator.js";

type Comparable = string | number | Date;

export class InMemoryCriteriaEvaluator {
  static apply<T>(
    items: T[],
    criteria: Criteria,
    toPrimitives: (item: T) => Record<string, unknown>,
  ): T[] {
    let results = [...items];

    if (criteria.hasFilters()) {
      results = results.filter((item) =>
        criteria.filters.filters.every((filter) =>
          InMemoryCriteriaEvaluator.matchesFilter(toPrimitives(item), filter),
        ),
      );
    }

    if (criteria.order.hasOrder()) {
      const field = criteria.order.orderBy.value;
      const isAsc = criteria.order.orderType.isAsc();
      results.sort((a, b) => {
        const aVal = toPrimitives(a)[field] as Comparable;
        const bVal = toPrimitives(b)[field] as Comparable;
        if (aVal < bVal) return isAsc ? -1 : 1;
        if (aVal > bVal) return isAsc ? 1 : -1;
        return 0;
      });
    }

    const offset = criteria.offset ?? 0;
    return results.slice(
      offset,
      criteria.limit !== undefined ? offset + criteria.limit : undefined,
    );
  }

  private static matchesFilter(
    primitives: Record<string, unknown>,
    filter: Filter,
  ): boolean {
    const fieldValue = primitives[filter.field.value] as Comparable;
    const filterValue = filter.value.value;

    switch (filter.operator.value) {
      case Operator.EQUAL:
        return String(fieldValue) === filterValue;
      case Operator.NOT_EQUAL:
        return String(fieldValue) !== filterValue;
      case Operator.GT:
        return fieldValue > InMemoryCriteriaEvaluator.coerce(fieldValue, filterValue);
      case Operator.LT:
        return fieldValue < InMemoryCriteriaEvaluator.coerce(fieldValue, filterValue);
      case Operator.CONTAINS:
        return String(fieldValue).includes(filterValue);
      case Operator.NOT_CONTAINS:
        return !String(fieldValue).includes(filterValue);
      default:
        return true;
    }
  }

  private static coerce(reference: Comparable, value: string): Comparable {
    if (reference instanceof Date) return new Date(value);
    if (typeof reference === "number") return Number(value);
    return value;
  }
}

import { Criteria } from "../../../domain/criteria/Criteria.js";
import { Filter } from "../../../domain/criteria/Filter.js";
import { Operator } from "../../../domain/criteria/FilterOperator.js";

type MongoFilter = Record<string, unknown>;

export class MongoCriteriaConverter {
  convert(criteria: Criteria): {
    filter: MongoFilter;
    sort?: Record<string, 1 | -1>;
    limit?: number;
    skip?: number;
  } {
    const filter = criteria.hasFilters() ? this.buildFilter(criteria) : {};

    const sort =
      criteria.order.hasOrder()
        ? {
            [criteria.order.orderBy.value]: criteria.order.orderType.isAsc()
              ? (1 as const)
              : (-1 as const),
          }
        : undefined;

    return {
      filter,
      sort,
      limit: criteria.limit,
      skip: criteria.offset,
    };
  }

  private buildFilter(criteria: Criteria): MongoFilter {
    return criteria.filters.filters.reduce<MongoFilter>(
      (acc, filter) => ({ ...acc, ...this.filterToMongo(filter) }),
      {},
    );
  }

  private filterToMongo(filter: Filter): MongoFilter {
    const field = filter.field.value;
    const value = filter.value.value;

    switch (filter.operator.value) {
      case Operator.EQUAL:
        return { [field]: value };
      case Operator.NOT_EQUAL:
        return { [field]: { $ne: value } };
      case Operator.GT:
        return { [field]: { $gt: value } };
      case Operator.LT:
        return { [field]: { $lt: value } };
      case Operator.CONTAINS:
        return { [field]: { $regex: value, $options: "i" } };
      case Operator.NOT_CONTAINS:
        return { [field]: { $not: { $regex: value, $options: "i" } } };
      default:
        return {};
    }
  }
}

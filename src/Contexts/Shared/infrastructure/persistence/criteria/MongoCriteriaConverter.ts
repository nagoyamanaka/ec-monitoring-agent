import { Criteria } from "../../../domain/criteria/Criteria.js";
import { Filter } from "../../../domain/criteria/Filter.js";
import { FilterOperatorValues } from "../../../domain/criteria/FilterOperator.js";

type MongoFilter = Record<string, unknown>;

export class MongoCriteriaConverter {
  convert(criteria: Criteria): {
    filter: MongoFilter;
    sort?: Record<string, 1 | -1>;
    limit?: number;
    skip?: number;
  } {
    const filter = criteria.hasFilters()
      ? this.buildFilter(criteria)
      : {};

    const sort = criteria.order.hasOrder()
      ? { [criteria.order.orderBy]: criteria.order.orderType === "asc" ? 1 as const : -1 as const }
      : undefined;

    return {
      filter,
      sort,
      limit: criteria.limit,
      skip: criteria.offset,
    };
  }

  private buildFilter(criteria: Criteria): MongoFilter {
    return criteria.filters.filters.reduce<MongoFilter>((acc, filter) => {
      return { ...acc, ...this.filterToMongo(filter) };
    }, {});
  }

  private filterToMongo(filter: Filter): MongoFilter {
    const { field, operator, value } = filter;
    switch (operator.value) {
      case FilterOperatorValues.EQUAL:
        return { [field]: value };
      case FilterOperatorValues.NOT_EQUAL:
        return { [field]: { $ne: value } };
      case FilterOperatorValues.GT:
        return { [field]: { $gt: value } };
      case FilterOperatorValues.LT:
        return { [field]: { $lt: value } };
      case FilterOperatorValues.CONTAINS:
        return { [field]: { $regex: value, $options: "i" } };
      case FilterOperatorValues.NOT_CONTAINS:
        return { [field]: { $not: { $regex: value, $options: "i" } } };
      default:
        return {};
    }
  }
}

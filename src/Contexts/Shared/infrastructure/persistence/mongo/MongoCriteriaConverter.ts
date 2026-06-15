import { Criteria } from "../../../domain/criteria/Criteria.js";
import { Filter } from "../../../domain/criteria/Filter.js";
import { Operator } from "../../../domain/criteria/FilterOperator.js";
import { Filters } from "../../../domain/criteria/Filters.js";
import { Order } from "../../../domain/criteria/Order.js";

type MongoFilterOperator = "$eq" | "$ne" | "$gt" | "$lt" | "$regex";
type MongoFilterValue = boolean | string | number;
type MongoFilterOperation = { [op in MongoFilterOperator]?: MongoFilterValue };
type MongoFilter =
  | { [field: string]: MongoFilterOperation }
  | { [field: string]: { $not: MongoFilterOperation } };
type MongoDirection = 1 | -1;
type MongoSort = { [field: string]: MongoDirection };

export interface MongoQuery {
  filter: MongoFilter;
  sort: MongoSort;
  skip: number;
  limit: number;
}

type FilterTransformer = (filter: Filter) => MongoFilter;

export class MongoCriteriaConverter {
  private readonly filterTransformers: Map<Operator, FilterTransformer>;

  constructor() {
    this.filterTransformers = new Map([
      [Operator.EQUAL, this.equalFilter],
      [Operator.NOT_EQUAL, this.notEqualFilter],
      [Operator.GT, this.greaterThanFilter],
      [Operator.LT, this.lowerThanFilter],
      [Operator.CONTAINS, this.containsFilter],
      [Operator.NOT_CONTAINS, this.notContainsFilter],
    ]);
  }

  convert(criteria: Criteria): MongoQuery {
    return {
      filter: criteria.hasFilters() ? this.generateFilter(criteria.filters) : {},
      sort: criteria.order.hasOrder() ? this.generateSort(criteria.order) : { _id: -1 },
      skip: criteria.offset ?? 0,
      limit: criteria.limit ?? 0,
    };
  }

  private generateFilter(filters: Filters): MongoFilter {
    const parts = filters.filters.map((filter) => {
      const transformer = this.filterTransformers.get(filter.operator.value);
      if (!transformer) {
        throw new Error(`Unexpected operator value: ${filter.operator.value}`);
      }
      return transformer(filter);
    });
    return Object.assign({}, ...parts);
  }

  private generateSort(order: Order): MongoSort {
    const field = order.orderBy.value === "id" ? "_id" : order.orderBy.value;
    return { [field]: order.orderType.isAsc() ? 1 : -1 };
  }

  private equalFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $eq: filter.value.value } };
  }

  private notEqualFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $ne: filter.value.value } };
  }

  private greaterThanFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $gt: filter.value.value } };
  }

  private lowerThanFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $lt: filter.value.value } };
  }

  private containsFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $regex: filter.value.value } };
  }

  private notContainsFilter(filter: Filter): MongoFilter {
    return { [filter.field.value]: { $not: { $regex: filter.value.value } } };
  }
}

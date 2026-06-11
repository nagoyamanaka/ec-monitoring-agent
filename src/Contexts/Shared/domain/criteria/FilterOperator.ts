export const FilterOperatorValues = {
  EQUAL: "=",
  NOT_EQUAL: "!=",
  GT: ">",
  LT: "<",
  CONTAINS: "CONTAINS",
  NOT_CONTAINS: "NOT_CONTAINS",
} as const;

export type FilterOperatorValue =
  (typeof FilterOperatorValues)[keyof typeof FilterOperatorValues];

export class FilterOperator {
  readonly value: FilterOperatorValue;

  constructor(value: FilterOperatorValue) {
    this.value = value;
  }

  static equal(): FilterOperator {
    return new FilterOperator(FilterOperatorValues.EQUAL);
  }

  static notEqual(): FilterOperator {
    return new FilterOperator(FilterOperatorValues.NOT_EQUAL);
  }

  static gt(): FilterOperator {
    return new FilterOperator(FilterOperatorValues.GT);
  }

  static lt(): FilterOperator {
    return new FilterOperator(FilterOperatorValues.LT);
  }

  static contains(): FilterOperator {
    return new FilterOperator(FilterOperatorValues.CONTAINS);
  }

  static notContains(): FilterOperator {
    return new FilterOperator(FilterOperatorValues.NOT_CONTAINS);
  }
}

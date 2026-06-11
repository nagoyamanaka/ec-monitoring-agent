import { FilterOperator } from "./FilterOperator.js";

export class Filter {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: string;

  constructor(field: string, operator: FilterOperator, value: string) {
    this.field = field;
    this.operator = operator;
    this.value = value;
  }

  static fromValues(values: {
    field: string;
    operator: string;
    value: string;
  }): Filter {
    return new Filter(
      values.field,
      new FilterOperator(values.operator as FilterOperator["value"]),
      values.value,
    );
  }
}

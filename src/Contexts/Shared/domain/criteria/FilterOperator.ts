import { EnumValueObject } from "../value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../errors/InvalidArgumentError.js";

export enum Operator {
  EQUAL = "=",
  NOT_EQUAL = "!=",
  GT = ">",
  LT = "<",
  CONTAINS = "CONTAINS",
  NOT_CONTAINS = "NOT_CONTAINS",
}

export class FilterOperator extends EnumValueObject<Operator> {
  constructor(value: Operator) {
    super(value, Object.values(Operator));
  }

  static fromValue(value: string): FilterOperator {
    return new FilterOperator(value as Operator);
  }

  public isPositive(): boolean {
    return (
      this.value !== Operator.NOT_EQUAL && this.value !== Operator.NOT_CONTAINS
    );
  }

  protected throwErrorForInvalidValue(value: Operator): void {
    throw new InvalidArgumentError(`The filter operator ${value} is invalid`);
  }

  static equal(): FilterOperator {
    return this.fromValue(Operator.EQUAL);
  }

  static notEqual(): FilterOperator {
    return this.fromValue(Operator.NOT_EQUAL);
  }

  static gt(): FilterOperator {
    return this.fromValue(Operator.GT);
  }

  static lt(): FilterOperator {
    return this.fromValue(Operator.LT);
  }

  static contains(): FilterOperator {
    return this.fromValue(Operator.CONTAINS);
  }

  static notContains(): FilterOperator {
    return this.fromValue(Operator.NOT_CONTAINS);
  }
}

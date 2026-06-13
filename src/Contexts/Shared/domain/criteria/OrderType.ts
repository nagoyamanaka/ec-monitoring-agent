import { EnumValueObject } from "../value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../errors/InvalidArgumentError.js";

export enum OrderTypes {
  ASC = "asc",
  DESC = "desc",
  NONE = "none",
}

export class OrderType extends EnumValueObject<OrderTypes> {
  constructor(value: OrderTypes) {
    super(value, Object.values(OrderTypes));
  }

  static fromValue(value: string): OrderType {
    return new OrderType(value as OrderTypes);
  }

  public isNone(): boolean {
    return this.value === OrderTypes.NONE;
  }

  public isAsc(): boolean {
    return this.value === OrderTypes.ASC;
  }

  protected throwErrorForInvalidValue(value: OrderTypes): void {
    throw new InvalidArgumentError(`The order type ${value} is invalid`);
  }
}

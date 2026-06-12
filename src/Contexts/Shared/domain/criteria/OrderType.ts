import { EnumValueObject } from "../value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../value-object/InvalidArgumentError.js";

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
    const isOrderType = (Object.values(OrderTypes) as string[]).includes(value);
    if (isOrderType) {
      return new OrderType(value as OrderTypes);
    }

    throw new InvalidArgumentError(`The order type ${value} is invalid`);
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

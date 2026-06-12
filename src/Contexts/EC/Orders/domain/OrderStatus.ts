import { EnumValueObject } from "../../../Shared/domain/value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export enum OrderStatusValues {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export class OrderStatus extends EnumValueObject<OrderStatusValues> {
  constructor(value: OrderStatusValues) {
    super(value, Object.values(OrderStatusValues));
  }

  static pending(): OrderStatus {
    return new OrderStatus(OrderStatusValues.PENDING);
  }

  static confirmed(): OrderStatus {
    return new OrderStatus(OrderStatusValues.CONFIRMED);
  }

  static failed(): OrderStatus {
    return new OrderStatus(OrderStatusValues.FAILED);
  }

  static fromString(value: string): OrderStatus {
    return new OrderStatus(value as OrderStatusValues);
  }

  isPending(): boolean {
    return this.value === OrderStatusValues.PENDING;
  }

  isConfirmed(): boolean {
    return this.value === OrderStatusValues.CONFIRMED;
  }

  isFailed(): boolean {
    return this.value === OrderStatusValues.FAILED;
  }

  protected throwErrorForInvalidValue(value: OrderStatusValues): void {
    throw new InvalidArgumentError(`Invalid OrderStatus: "${value}"`);
  }
}

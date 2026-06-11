import { ValueObject } from "../../../Shared/domain/ValueObject.js";
import { DomainError } from "../../../Shared/domain/DomainError.js";

export const OrderStatusValues = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
} as const;

export type OrderStatusValue =
  (typeof OrderStatusValues)[keyof typeof OrderStatusValues];

export class InvalidOrderStatusError extends DomainError {
  readonly errorCode = "INVALID_ORDER_STATUS";

  constructor(value: string) {
    super(`Invalid OrderStatus: "${value}"`);
  }
}

export class OrderStatus extends ValueObject<OrderStatusValue> {
  constructor(value: OrderStatusValue) {
    super(value);
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
    if (!Object.values(OrderStatusValues).includes(value as OrderStatusValue)) {
      throw new InvalidOrderStatusError(value);
    }
    return new OrderStatus(value as OrderStatusValue);
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
}

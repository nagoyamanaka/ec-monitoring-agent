import { ValueObject } from "../../../Shared/domain/ValueObject.js";
import { DomainError } from "../../../Shared/domain/DomainError.js";
import { OrderItem, OrderItemPrimitive } from "./OrderItem.js";
import { TotalAmount } from "./TotalAmount.js";

export class EmptyOrderItemsError extends DomainError {
  readonly errorCode = "EMPTY_ORDER_ITEMS";

  constructor() {
    super("Order must contain at least one item");
  }
}

export class OrderItems extends ValueObject<OrderItem[]> {
  constructor(value: OrderItem[]) {
    if (value.length === 0) {
      throw new EmptyOrderItemsError();
    }
    super(value);
  }

  totalAmount(): TotalAmount {
    const total = this.value.reduce((sum, item) => sum + item.subtotal(), 0);
    return new TotalAmount(total);
  }

  toPrimitives(): OrderItemPrimitive[] {
    return this.value.map((item) => item.toPrimitives());
  }

  static fromPrimitives(p: OrderItemPrimitive[]): OrderItems {
    return new OrderItems(p.map(OrderItem.fromPrimitives));
  }
}

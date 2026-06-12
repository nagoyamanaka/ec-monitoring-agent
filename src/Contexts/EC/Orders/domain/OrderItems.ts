import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";
import { OrderItem, OrderItemPrimitive } from "./OrderItem.js";
import { TotalAmount } from "./TotalAmount.js";

export class OrderItems {
  readonly value: OrderItem[];

  constructor(value: OrderItem[]) {
    if (value.length === 0) {
      throw new InvalidArgumentError("Order must contain at least one item");
    }
    this.value = value;
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

import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export type OrderItemPrimitive = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export class OrderItem {
  readonly productId: string;
  readonly quantity: number;
  readonly unitPrice: number;

  constructor(productId: string, quantity: number, unitPrice: number) {
    if (quantity < 1) {
      throw new InvalidArgumentError(
        `OrderItem quantity must be >= 1, got: ${quantity}`,
      );
    }
    if (unitPrice < 0) {
      throw new InvalidArgumentError(
        `OrderItem unitPrice must be >= 0, got: ${unitPrice}`,
      );
    }
    this.productId = productId;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
  }

  subtotal(): number {
    return this.quantity * this.unitPrice;
  }

  toPrimitives(): OrderItemPrimitive {
    return {
      productId: this.productId,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
    };
  }

  static fromPrimitives(p: OrderItemPrimitive): OrderItem {
    return new OrderItem(p.productId, p.quantity, p.unitPrice);
  }
}

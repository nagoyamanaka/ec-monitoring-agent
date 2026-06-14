import { Response } from "../../../Shared/domain/Response.js";
import { Order } from "../domain/Order.js";

interface OrderResponseItem {
  id: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export class OrderResponse implements Response {
  public readonly orders: Array<OrderResponseItem>;

  constructor(orders: Array<Order>) {
    this.orders = orders.map((order) => {
      const p = order.toPrimitives();
      return {
        id: p.id,
        customerId: p.customerId,
        items: p.items,
        totalAmount: p.items.reduce(
          (sum, i) => sum + i.unitPrice * i.quantity,
          0,
        ),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });
  }
}

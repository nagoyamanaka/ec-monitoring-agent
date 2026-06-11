import { OrderItemPrimitive } from "../../domain/OrderItem.js";

// TODO(Step3): Implement PlaceOrderCommandHandler
export interface PlaceOrderCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly items: OrderItemPrimitive[];
}

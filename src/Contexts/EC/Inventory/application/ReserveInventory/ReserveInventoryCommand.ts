import { OrderItemPrimitive } from "../../domain/Inventory.js";

// TODO(Step3): Implement ReserveInventoryCommandHandler
export interface ReserveInventoryCommand {
  readonly orderId: string;
  readonly items: OrderItemPrimitive[];
}

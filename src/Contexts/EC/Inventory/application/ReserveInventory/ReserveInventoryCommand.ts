import { Command } from "../../../../Shared/domain/Command.js";
import { OrderItemPrimitive } from "../../domain/Inventory.js";

// TODO(Step3): Implement ReserveInventoryCommandHandler
export class ReserveInventoryCommand extends Command {
  constructor(
    readonly orderId: string,
    readonly items: OrderItemPrimitive[],
  ) {
    super();
  }
}

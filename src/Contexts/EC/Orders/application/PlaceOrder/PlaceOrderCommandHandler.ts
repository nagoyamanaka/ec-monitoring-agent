import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { CustomerId } from "../../domain/CustomerId.js";
import { OrderId } from "../../domain/OrderId.js";
import { OrderItem } from "../../domain/OrderItem.js";
import { OrderItems } from "../../domain/OrderItems.js";
import { PlaceOrderCommand } from "./PlaceOrderCommand.js";
import { PlaceOrderUseCase } from "./PlaceOrderUseCase.js";

export class PlaceOrderCommandHandler
  implements CommandHandler<PlaceOrderCommand>
{
  constructor(private readonly placeOrderUseCase: PlaceOrderUseCase) {}

  subscribedTo() {
    return PlaceOrderCommand;
  }

  async handle(command: PlaceOrderCommand): Promise<void> {
    const id = new OrderId(command.orderId);
    const customerId = new CustomerId(command.customerId);
    const items = new OrderItems(
      command.items.map(
        (item) => new OrderItem(item.productId, item.quantity, item.unitPrice),
      ),
    );

    await this.placeOrderUseCase.run({ id, customerId, items });
  }
}

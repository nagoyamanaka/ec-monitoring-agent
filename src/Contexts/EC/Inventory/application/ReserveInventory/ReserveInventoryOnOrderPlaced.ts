import { DomainEventClass } from "../../../../Shared/domain/DomainEvent.js";
import { DomainEventSubscriber } from "../../../../Shared/domain/DomainEventSubscriber.js";
import { CommandBus } from "../../../../Shared/domain/CommandBus.js";
import { OrderPlacedDomainEvent } from "../../../Orders/domain/OrderPlacedDomainEvent.js";
import { ReserveInventoryCommand } from "./ReserveInventoryCommand.js";

export class ReserveInventoryOnOrderPlaced
  implements DomainEventSubscriber<OrderPlacedDomainEvent>
{
  constructor(private readonly commandBus: CommandBus) {}

  subscribedTo(): Array<DomainEventClass> {
    return [OrderPlacedDomainEvent];
  }

  async on(event: OrderPlacedDomainEvent): Promise<void> {
    await this.commandBus.dispatch(
      new ReserveInventoryCommand(event.aggregateId, event.items),
    );
  }
}

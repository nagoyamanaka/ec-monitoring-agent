import { DomainEventClass } from "../../../../Shared/domain/DomainEvent.js";
import { DomainEventSubscriber } from "../../../../Shared/domain/DomainEventSubscriber.js";
import { OrderPlacedDomainEvent } from "../../../Orders/domain/OrderPlacedDomainEvent.js";
import { ReserveInventoryUseCase } from "./ReserveInventoryUseCase.js";

export class ReserveInventoryOnOrderPlaced
  implements DomainEventSubscriber<OrderPlacedDomainEvent>
{
  constructor(private readonly reserveInventoryUseCase: ReserveInventoryUseCase) {}

  subscribedTo(): Array<DomainEventClass> {
    return [OrderPlacedDomainEvent];
  }

  async on(event: OrderPlacedDomainEvent): Promise<void> {
    await this.reserveInventoryUseCase.run(event.aggregateId, event.items);
  }
}

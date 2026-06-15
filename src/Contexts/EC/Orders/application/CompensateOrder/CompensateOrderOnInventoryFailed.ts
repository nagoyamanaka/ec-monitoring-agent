import { DomainEventClass } from "../../../../Shared/domain/DomainEvent.js";
import { DomainEventSubscriber } from "../../../../Shared/domain/DomainEventSubscriber.js";
import { InventoryReservationFailedDomainEvent } from "../../../Inventory/domain/InventoryReservationFailedDomainEvent.js";
import { CompensateOrderUseCase } from "./CompensateOrderUseCase.js";

export class CompensateOrderOnInventoryFailed
  implements DomainEventSubscriber<InventoryReservationFailedDomainEvent>
{
  constructor(private readonly compensateOrderUseCase: CompensateOrderUseCase) {}

  subscribedTo(): Array<DomainEventClass> {
    return [InventoryReservationFailedDomainEvent];
  }

  async on(event: InventoryReservationFailedDomainEvent): Promise<void> {
    await this.compensateOrderUseCase.run(event.orderId);
  }
}

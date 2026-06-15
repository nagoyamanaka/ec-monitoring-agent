import { CompensateOrderOnInventoryFailed } from "../../../../../Contexts/EC/Orders/application/CompensateOrder/CompensateOrderOnInventoryFailed.js";
import { CompensateOrderUseCase } from "../../../../../Contexts/EC/Orders/application/CompensateOrder/CompensateOrderUseCase.js";
import { ReserveInventoryOnOrderPlaced } from "../../../../../Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryOnOrderPlaced.js";
import { ReserveInventoryUseCase } from "../../../../../Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryUseCase.js";
import { DomainEventSubscribers } from "../../../../../Contexts/Shared/infrastructure/EventBus/DomainEventSubscribers.js";

export function buildEcSubscribers(
  reserveInventoryUseCase: ReserveInventoryUseCase,
  compensateOrderUseCase: CompensateOrderUseCase,
): DomainEventSubscribers {
  return new DomainEventSubscribers([
    new ReserveInventoryOnOrderPlaced(reserveInventoryUseCase),
    new CompensateOrderOnInventoryFailed(compensateOrderUseCase),
  ]);
}

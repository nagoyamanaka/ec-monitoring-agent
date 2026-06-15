import { EventBus } from "../../../../Shared/domain/EventBus.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import {
  Inventory,
  InventoryFailureReason,
  OrderItemPrimitive,
} from "../../domain/Inventory.js";
import {
  InventoryRepository,
  ReserveStockResult,
} from "../../domain/InventoryRepository.js";
import { InventoryReservationFailedDomainEvent } from "../../domain/InventoryReservationFailedDomainEvent.js";
import { ProductId } from "../../domain/ProductId.js";

type Reservation = { inventory: Inventory; quantity: number };

type SuccessRecord = {
  inventory: Inventory;
  quantity: number;
  outcome: Extract<ReserveStockResult, { success: true }>;
};

export class ReserveInventoryUseCase {
  private static readonly MAX_RETRIES = 3;

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  async run(orderId: string, items: OrderItemPrimitive[]): Promise<void> {
    const reservations = await this.validateStock(orderId, items);
    if (!reservations) return;

    const successRecords = await this.reserveAll(orderId, reservations);
    if (!successRecords) return;

    await this.publishReservationEvents(orderId, successRecords);
  }

  private async validateStock(
    orderId: string,
    items: OrderItemPrimitive[],
  ): Promise<Reservation[] | null> {
    const reservations: Reservation[] = [];

    for (const item of items) {
      const productId = new ProductId(item.productId);
      const inventory =
        await this.inventoryRepository.findByProductId(productId);

      if (!inventory || !inventory.stock.hasEnoughStock(item.quantity)) {
        await this.eventBus.publish([
          new InventoryReservationFailedDomainEvent({
            productId: item.productId,
            orderId,
            requestedQuantity: item.quantity,
            currentStock: inventory?.stock.value ?? 0,
            reason: InventoryFailureReason.INSUFFICIENT_STOCK,
          }),
        ]);
        await this.logger.warn({
          service: "ec-backend",
          trace_id: orderId,
          span_id: "reserve_inventory",
          action: "reserve_inventory_insufficient",
          message: `在庫不足（Phase1）：${item.productId}`,
        });
        return null;
      }

      reservations.push({ inventory, quantity: item.quantity });
    }

    return reservations;
  }

  private async reserveAll(
    orderId: string,
    reservations: Reservation[],
  ): Promise<SuccessRecord[] | null> {
    const successRecords: SuccessRecord[] = [];

    for (const r of reservations) {
      const { result, inventory } = await this.attemptReserveWithRetry(
        r.inventory,
        r.quantity,
      );

      if (!result.success) {
        await this.eventBus.publish([
          new InventoryReservationFailedDomainEvent({
            productId: inventory.productId.value,
            orderId,
            requestedQuantity: r.quantity,
            currentStock: inventory.stock.value,
            reason: InventoryFailureReason.CONCURRENT_CONFLICT,
            reservedProductIds: successRecords.map(
              (s) => s.inventory.productId.value,
            ),
          }),
        ]);
        await this.logger.warn({
          service: "ec-backend",
          trace_id: orderId,
          span_id: "reserve_inventory",
          action: "reserve_inventory_rollback",
          message: `楽観ロック競合・ロールバック：${orderId}`,
        });
        return null;
      }

      successRecords.push({ inventory, quantity: r.quantity, outcome: result });
    }

    return successRecords;
  }

  private async attemptReserveWithRetry(
    inventory: Inventory,
    quantity: number,
  ): Promise<{ result: ReserveStockResult; inventory: Inventory }> {
    let current = inventory;

    for (
      let attempt = 0;
      attempt < ReserveInventoryUseCase.MAX_RETRIES;
      attempt++
    ) {
      const result = await this.inventoryRepository.reserveStock({
        productId: current.productId,
        quantity,
        expectedVersion: current.version,
      });

      if (result.success) return { result, inventory: current };

      const canRetry =
        result.reason === "CONCURRENT_CONFLICT" &&
        attempt < ReserveInventoryUseCase.MAX_RETRIES - 1;

      if (!canRetry) return { result, inventory: current };

      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 100),
      );
      const refreshed = await this.inventoryRepository.findByProductId(
        current.productId,
      );
      if (!refreshed || !refreshed.stock.hasEnoughStock(quantity)) {
        return { result, inventory: current };
      }
      current = refreshed;
    }

    throw new Error("unreachable");
  }

  private async publishReservationEvents(
    orderId: string,
    successRecords: SuccessRecord[],
  ): Promise<void> {
    const allEvents = successRecords.flatMap(
      ({ inventory, quantity, outcome }: SuccessRecord) => {
        inventory.reserve(orderId, quantity, outcome);
        return inventory.pullDomainEvents();
      },
    );
    await this.eventBus.publish(allEvents);

    await this.logger.info({
      service: "ec-backend",
      trace_id: orderId,
      span_id: "reserve_inventory",
      action: "reserve_inventory",
      message: `在庫引き当て成功：${orderId}`,
    });
  }
}

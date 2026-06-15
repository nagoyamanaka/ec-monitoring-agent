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
    // Phase 1: 全商品の在庫確認（読み取り）
    // 1回でもinventory確保にfailしたら、注文全体をキャンセルするので、途中でイベント発行で中断する
    const reservations: Array<{ inventory: Inventory; quantity: number }> = [];

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
        return;
      }

      reservations.push({ inventory, quantity: item.quantity });
    }

    // Phase 2: 全商品を更新（楽観ロック）
    const successRecords: SuccessRecord[] = [];

    for (const { inventory, quantity } of reservations) {
      let currentInventory = inventory;
      let finalResult: ReserveStockResult | undefined;

      for (
        let attempt = 0;
        attempt < ReserveInventoryUseCase.MAX_RETRIES;
        attempt++
      ) {
        const result = await this.inventoryRepository.reserveStock({
          productId: currentInventory.productId,
          quantity,
          expectedVersion: currentInventory.version,
        });

        if (result.success) {
          finalResult = result;
          break;
        }

        const isLastAttempt =
          attempt === ReserveInventoryUseCase.MAX_RETRIES - 1;
        if (result.reason === "CONCURRENT_CONFLICT" && !isLastAttempt) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100),
          );
          const refreshed = await this.inventoryRepository.findByProductId(
            currentInventory.productId,
          );
          if (refreshed && refreshed.stock.hasEnoughStock(quantity)) {
            currentInventory = refreshed;
            continue;
          }
        }

        finalResult = result;
        break;
      }

      if (!finalResult?.success) {
        // 成功済み分の補償は reservedProductIds を受け取った補正 job が行う。
        // Order 側は CompensateOrderOnInventoryFailed が FAILED に補償する。
        await this.eventBus.publish([
          new InventoryReservationFailedDomainEvent({
            productId: currentInventory.productId.value,
            orderId,
            requestedQuantity: quantity,
            currentStock: currentInventory.stock.value,
            reason: InventoryFailureReason.CONCURRENT_CONFLICT,
            reservedProductIds: successRecords.map(
              (r) => r.inventory.productId.value,
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
        return;
      }

      successRecords.push({
        inventory: currentInventory,
        quantity,
        outcome: finalResult,
      });
    }

    // 全商品成功 — DomainEvent 生成・一括発行
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

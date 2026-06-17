import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { OrderId } from "../../domain/OrderId.js";
import { OrderRepository } from "../../domain/OrderRepository.js";

export class CompensateOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly logger: Logger,
  ) {}

  async run(orderId: string): Promise<void> {
    const id = new OrderId(orderId);
    const order = await this.orderRepository.findById(id);

    if (!order) {
      await this.logger.warn({
        service: "ec-backend",
action: "compensate_order_skipped",
        message: `注文未存在のためスキップ：${orderId}`,
      });
      return;
    }

    if (!order.status.isPending()) {
      await this.logger.warn({
        service: "ec-backend",
action: "compensate_order_skipped",
        message: `注文が既にPENDING以外のためスキップ：${orderId}（status=${order.status.value}）`,
      });
      return;
    }

    order.failInventory();
    await this.orderRepository.save(order);

    await this.logger.warn({
      service: "ec-backend",
      action: "compensate_order",
      message: `注文補償処理：${orderId} → FAILED`,
    });
  }
}

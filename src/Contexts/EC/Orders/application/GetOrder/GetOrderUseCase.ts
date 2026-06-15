import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { OrderId } from "../../domain/OrderId.js";
import { OrderRepository } from "../../domain/OrderRepository.js";
import { OrderResourceNotFoundError } from "../errors/OrderResourceNotFoundError.js";
import { OrderResponse } from "../OrderResponse.js";

export class GetOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly logger: Logger,
  ) {}

  async run(id: OrderId): Promise<OrderResponse> {
    const order = await this.orderRepository.findById(id);

    if (!order) {
      await this.logger.warn({
        service: "ec-backend",
        trace_id: id.value,
        span_id: "get_order",
        action: "get_order_not_found",
        message: `注文未存在：${id.value}`,
      });
      throw new OrderResourceNotFoundError("Order", id.value);
    }

    return new OrderResponse([order]);
  }
}

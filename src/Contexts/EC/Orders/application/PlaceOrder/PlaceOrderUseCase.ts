import { EventBus } from "../../../../Shared/domain/EventBus.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { RepositoryError } from "../../../../Shared/infrastructure/errors/RepositoryError.js";
import { PaymentTimeoutDomainEvent } from "../../../Payment/domain/PaymentTimeoutDomainEvent.js";
import { CustomerId } from "../../domain/CustomerId.js";
import { Order } from "../../domain/Order.js";
import { OrderId } from "../../domain/OrderId.js";
import { OrderItems } from "../../domain/OrderItems.js";
import { OrderRepository } from "../../domain/OrderRepository.js";
import { PaymentGateway } from "../../domain/PaymentGateway.js";
import { PlaceOrderFailedError } from "./PlaceOrderFailedError.js";

export class PlaceOrderUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventBus: EventBus,
    private readonly paymentGateway: PaymentGateway,
    private readonly logger: Logger,
  ) {}

  async run(params: {
    id: OrderId;
    customerId: CustomerId;
    items: OrderItems;
  }): Promise<void> {
    const { id, customerId, items } = params;
    const amount = items.subtotalAmount().value;

    await this.logger.info({
      service: "ec-backend",
      trace_id: id.value,
      span_id: "place_order",
      action: "place_order_payment_started",
      message: `決済開始：${id.value}, amount=${amount}`,
      timestamp: new Date().toISOString(),
    });

    const paymentResult = await this.paymentGateway.run({
      orderId: id.value,
      amount,
    });

    if (!paymentResult.success) {
      await this.eventBus.publish([
        new PaymentTimeoutDomainEvent({
          paymentAttemptId: crypto.randomUUID(),
          orderId: id.value,
          customerId: customerId.value,
          amount,
        }),
      ]);
      await this.logger.warn({
        service: "ec-backend",
        trace_id: id.value,
        span_id: "place_order",
        action: "place_order_payment_failed",
        message: `決済失敗：${id.value}, reason=${paymentResult.reason}`,
        timestamp: new Date().toISOString(),
      });
      throw new PlaceOrderFailedError(id.value, paymentResult.reason);
    }

    // 決済成功を即座に記録する。この後の処理（Order保存）が失敗した場合に
    // place_order_payment_succeeded ログがあって place_order ログがない orderId を
    // Cloud Logging で検出し、未消込の決済として検知できる。
    await this.logger.info({
      service: "ec-backend",
      trace_id: id.value,
      span_id: "place_order",
      action: "place_order_payment_succeeded",
      message: `決済完了：${id.value}, transactionId=${paymentResult.transactionId}`,
      timestamp: new Date().toISOString(),
    });

    const order = Order.place({ id, customerId, items });

    try {
      await this.orderRepository.save(order);
    } catch (cause) {
      throw new RepositoryError("save", cause);
    }

    try {
      await this.eventBus.publish(order.pullDomainEvents());
    } catch (cause) {
      await this.logger.warn({
        service: "ec-backend",
        trace_id: id.value,
        span_id: "place_order",
        action: "place_order_event_publish_failed",
        message: `EventBus publish失敗：${id.value}`,
        timestamp: new Date().toISOString(),
        stack_trace: cause instanceof Error ? cause.stack : String(cause),
      });
    }

    await this.logger.info({
      service: "ec-backend",
      trace_id: id.value,
      span_id: "place_order",
      action: "place_order",
      message: `注文確定：${id.value}`,
      timestamp: new Date().toISOString(),
    });
  }
}

import { DomainEventClass } from "../../../../Shared/domain/DomainEvent.js";
import { InventoryReservationFailedDomainEvent } from "../../../../EC/Inventory/domain/InventoryReservationFailedDomainEvent.js";
import { OrderPlacedDomainEvent } from "../../../../EC/Orders/domain/OrderPlacedDomainEvent.js";
import { PaymentTimeoutDomainEvent } from "../../../../EC/Payment/domain/PaymentTimeoutDomainEvent.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { CollectMonitoringEventSubscriber } from "./CollectMonitoringEventSubscriber.js";

type SupportedECDomainEvent =
  | OrderPlacedDomainEvent
  | InventoryReservationFailedDomainEvent
  | PaymentTimeoutDomainEvent;

/**
 * EC 源の ingest アダプタ。EC DomainEvent の発火を受けて MonitoringEvent へ正規化する。
 * EC 固有の型に触れるのは本クラスの toMonitoringEvent だけ（観測フレーム境界）。
 */
export class CollectMonitoringEventOnECEventPublished extends CollectMonitoringEventSubscriber<SupportedECDomainEvent> {
  subscribedTo(): Array<DomainEventClass> {
    return [
      OrderPlacedDomainEvent,
      InventoryReservationFailedDomainEvent,
      PaymentTimeoutDomainEvent,
    ];
  }

  protected toMonitoringEvent(event: SupportedECDomainEvent): MonitoringEvent {
    const category = MonitoringEventCategory.application();

    if (event instanceof OrderPlacedDomainEvent) {
      return new MonitoringEvent({
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        occurredOn: event.occurredOn,
        category,
        source: "order",
        payload: {
          customerId: event.customerId,
          items: event.items,
          subtotalAmount: event.subtotalAmount,
        },
      });
    }

    if (event instanceof InventoryReservationFailedDomainEvent) {
      return new MonitoringEvent({
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        occurredOn: event.occurredOn,
        category,
        source: "inventory",
        payload: {
          orderId: event.orderId,
          requestedQuantity: event.requestedQuantity,
          currentStock: event.currentStock,
          reason: event.reason.value,
          reservedProductIds: event.reservedProductIds,
        },
      });
    }

    if (event instanceof PaymentTimeoutDomainEvent) {
      // aggregateId = paymentAttemptId, orderId は payload
      return new MonitoringEvent({
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        occurredOn: event.occurredOn,
        category,
        source: "payment",
        payload: {
          orderId: event.orderId,
          customerId: event.customerId,
          amount: event.amount,
        },
      });
    }

    throw new Error(`Unhandled SupportedECDomainEvent: ${(event as { eventName?: string }).eventName}`);
  }
}

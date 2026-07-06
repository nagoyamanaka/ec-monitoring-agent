import { DomainEventClass } from "../../../../Shared/domain/DomainEvent.js";
import { InventoryReservationFailedDomainEvent } from "../../../../EC/Inventory/domain/InventoryReservationFailedDomainEvent.js";
import { OrderPlacedDomainEvent } from "../../../../EC/Orders/domain/OrderPlacedDomainEvent.js";
import { PaymentDeclinedDomainEvent } from "../../../../EC/Payment/domain/PaymentDeclinedDomainEvent.js";
import { PaymentTimeoutDomainEvent } from "../../../../EC/Payment/domain/PaymentTimeoutDomainEvent.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../Shared/domain/MonitoringEventCategory.js";
import { CollectMonitoringEventSubscriber } from "./CollectMonitoringEventSubscriber.js";

type SupportedECDomainEvent =
  | OrderPlacedDomainEvent
  | InventoryReservationFailedDomainEvent
  | PaymentTimeoutDomainEvent
  | PaymentDeclinedDomainEvent;

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
      PaymentDeclinedDomainEvent,
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
        // 正常系の業務イベント。観測上の緊急度は低い。
        severity: AlertSeverity.info(),
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
        // 在庫引当の失敗。回復可能だが要注意。
        severity: AlertSeverity.warning(),
        source: "inventory",
        // 在庫不足(INSUFFICIENT_STOCK)と楽観ロック競合(CONCURRENT_CONFLICT)は同一 eventName だが
        // 根本原因が別。reason を dedup の識別子に織り込み、別アラートとして扱う（畳み込み回避）。
        discriminator: event.reason.value,
        payload: {
          orderId: event.orderId,
          requestedQuantity: event.requestedQuantity,
          currentStock: event.currentStock,
          reason: event.reason.value,
          reservedProductIds: event.reservedProductIds,
        },
      });
    }

    if (event instanceof PaymentDeclinedDomainEvent) {
      // aggregateId = paymentAttemptId, orderId は payload
      return new MonitoringEvent({
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateId: event.aggregateId,
        occurredOn: event.occurredOn,
        category,
        // 与信拒否。ハンドリング済みの業務失敗で顧客はリトライ可能＝タイムアウトより一段軽い。
        // 過去の解決済みプロバイダ障害事例との類似分類（準・既知）の入力になる。
        severity: AlertSeverity.warning(),
        source: "payment",
        payload: {
          orderId: event.orderId,
          customerId: event.customerId,
          amount: event.amount,
          reason: event.reason,
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
        // 決済タイムアウト。売上に直結する致命的事象。
        severity: AlertSeverity.critical(),
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

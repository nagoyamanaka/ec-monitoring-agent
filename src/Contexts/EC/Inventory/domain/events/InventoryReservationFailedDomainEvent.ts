import { ECDomainEvent } from "../../../Shared/domain/ECDomainEvent.js";

export const InventoryFailureReason = {
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  CONCURRENT_CONFLICT: "CONCURRENT_CONFLICT",
} as const;

export type InventoryFailureReasonValue =
  (typeof InventoryFailureReason)[keyof typeof InventoryFailureReason];

export class InventoryReservationFailedDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = "ec.inventory.reservation_failed";

  readonly orderId: string;
  readonly requestedQuantity: number;
  readonly currentStock: number;
  readonly reason: InventoryFailureReasonValue;

  constructor(params: {
    productId: string;
    orderId: string;
    requestedQuantity: number;
    currentStock: number;
    reason: InventoryFailureReasonValue;
    eventId?: string;
    occurredOn?: Date;
  }) {
    super({
      eventName: InventoryReservationFailedDomainEvent.EVENT_NAME,
      aggregateId: params.productId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
    this.orderId = params.orderId;
    this.requestedQuantity = params.requestedQuantity;
    this.currentStock = params.currentStock;
    this.reason = params.reason;
  }

  toPrimitives(): Record<string, unknown> {
    return {
      orderId: this.orderId,
      requestedQuantity: this.requestedQuantity,
      currentStock: this.currentStock,
      reason: this.reason,
    };
  }

  static fromPrimitives(
    aggregateId: string,
    body: Record<string, unknown>,
    eventId: string,
    occurredOn: Date,
  ): InventoryReservationFailedDomainEvent {
    return new InventoryReservationFailedDomainEvent({
      productId: aggregateId,
      orderId: body.orderId as string,
      requestedQuantity: body.requestedQuantity as number,
      currentStock: body.currentStock as number,
      reason: body.reason as InventoryFailureReasonValue,
      eventId,
      occurredOn,
    });
  }
}

import { ECDomainEvent } from "../../Shared/domain/ECDomainEvent.js";

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
  readonly reservedProductIds: string[];

  constructor(params: {
    productId: string;
    orderId: string;
    requestedQuantity: number;
    currentStock: number;
    reason: InventoryFailureReasonValue;
    reservedProductIds?: string[];
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
    this.reservedProductIds = params.reservedProductIds ?? [];
  }

  toPrimitives(): Record<string, unknown> {
    return {
      orderId: this.orderId,
      requestedQuantity: this.requestedQuantity,
      currentStock: this.currentStock,
      reason: this.reason,
      reservedProductIds: this.reservedProductIds,
    };
  }

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): InventoryReservationFailedDomainEvent {
    return new InventoryReservationFailedDomainEvent({
      productId: params.aggregateId,
      orderId: params.attributes.orderId as string,
      requestedQuantity: params.attributes.requestedQuantity as number,
      currentStock: params.attributes.currentStock as number,
      reason: params.attributes.reason as InventoryFailureReasonValue,
      reservedProductIds: params.attributes.reservedProductIds as string[],
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
  }
}

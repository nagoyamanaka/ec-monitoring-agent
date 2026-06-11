import { ECDomainEvent } from "../../../Shared/domain/ECDomainEvent.js";

export class InventoryReservedDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = "ec.inventory.reserved";

  readonly orderId: string;
  readonly reservedQuantity: number;
  readonly remainingStock: number;

  constructor(params: {
    productId: string;
    orderId: string;
    reservedQuantity: number;
    remainingStock: number;
    eventId?: string;
    occurredOn?: Date;
  }) {
    super({
      eventName: InventoryReservedDomainEvent.EVENT_NAME,
      aggregateId: params.productId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
    this.orderId = params.orderId;
    this.reservedQuantity = params.reservedQuantity;
    this.remainingStock = params.remainingStock;
  }

  toPrimitives(): Record<string, unknown> {
    return {
      orderId: this.orderId,
      reservedQuantity: this.reservedQuantity,
      remainingStock: this.remainingStock,
    };
  }

  static fromPrimitives(
    aggregateId: string,
    body: Record<string, unknown>,
    eventId: string,
    occurredOn: Date,
  ): InventoryReservedDomainEvent {
    return new InventoryReservedDomainEvent({
      productId: aggregateId,
      orderId: body.orderId as string,
      reservedQuantity: body.reservedQuantity as number,
      remainingStock: body.remainingStock as number,
      eventId,
      occurredOn,
    });
  }
}

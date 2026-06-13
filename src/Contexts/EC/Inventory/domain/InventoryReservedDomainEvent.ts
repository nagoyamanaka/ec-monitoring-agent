import { ECDomainEvent } from "../../Shared/domain/ECDomainEvent.js";

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

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): InventoryReservedDomainEvent {
    return new InventoryReservedDomainEvent({
      productId: params.aggregateId,
      orderId: params.attributes.orderId as string,
      reservedQuantity: params.attributes.reservedQuantity as number,
      remainingStock: params.attributes.remainingStock as number,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
  }
}

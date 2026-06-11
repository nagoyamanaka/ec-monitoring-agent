import { ECDomainEvent } from "../../../Shared/domain/ECDomainEvent.js";
import { OrderItemPrimitive } from "../OrderItem.js";

export class InventoryReservationRequestedDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = "ec.order.inventory_reservation_requested";

  readonly items: OrderItemPrimitive[];

  constructor(params: {
    orderId: string;
    items: OrderItemPrimitive[];
    eventId?: string;
    occurredOn?: Date;
  }) {
    super({
      eventName: InventoryReservationRequestedDomainEvent.EVENT_NAME,
      aggregateId: params.orderId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
    this.items = params.items;
  }

  toPrimitives(): Record<string, unknown> {
    return {
      items: this.items,
    };
  }

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): InventoryReservationRequestedDomainEvent {
    return new InventoryReservationRequestedDomainEvent({
      orderId: params.aggregateId,
      items: params.attributes.items as OrderItemPrimitive[],
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
  }
}

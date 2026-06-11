import { ECDomainEvent } from "../../../Shared/domain/ECDomainEvent.js";
import { OrderItemPrimitive } from "../OrderItem.js";

export class OrderPlacedDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = "ec.order.placed";

  readonly customerId: string;
  readonly items: OrderItemPrimitive[];
  readonly totalAmount: number;

  constructor(params: {
    orderId: string;
    customerId: string;
    items: OrderItemPrimitive[];
    totalAmount: number;
    eventId?: string;
    occurredOn?: Date;
  }) {
    super({
      eventName: OrderPlacedDomainEvent.EVENT_NAME,
      aggregateId: params.orderId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
    this.customerId = params.customerId;
    this.items = params.items;
    this.totalAmount = params.totalAmount;
  }

  toPrimitives(): Record<string, unknown> {
    return {
      customerId: this.customerId,
      items: this.items,
      totalAmount: this.totalAmount,
    };
  }

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): OrderPlacedDomainEvent {
    return new OrderPlacedDomainEvent({
      orderId: params.aggregateId,
      customerId: params.attributes.customerId as string,
      items: params.attributes.items as OrderItemPrimitive[],
      totalAmount: params.attributes.totalAmount as number,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
  }
}

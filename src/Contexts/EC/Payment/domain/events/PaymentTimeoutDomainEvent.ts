import { ECDomainEvent } from "../../../Shared/domain/ECDomainEvent.js";

export class PaymentTimeoutDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = "ec.payment.timeout";

  readonly orderId: string;
  readonly customerId: string;
  readonly amount: number;

  constructor(params: {
    paymentAttemptId: string;
    orderId: string;
    customerId: string;
    amount: number;
    eventId?: string;
    occurredOn?: Date;
  }) {
    super({
      eventName: PaymentTimeoutDomainEvent.EVENT_NAME,
      aggregateId: params.paymentAttemptId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
    this.orderId = params.orderId;
    this.customerId = params.customerId;
    this.amount = params.amount;
  }

  toPrimitives(): Record<string, unknown> {
    return {
      orderId: this.orderId,
      customerId: this.customerId,
      amount: this.amount,
    };
  }

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): PaymentTimeoutDomainEvent {
    return new PaymentTimeoutDomainEvent({
      paymentAttemptId: params.aggregateId,
      orderId: params.attributes.orderId as string,
      customerId: params.attributes.customerId as string,
      amount: params.attributes.amount as number,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
  }
}

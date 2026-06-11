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

  static fromPrimitives(
    aggregateId: string,
    body: Record<string, unknown>,
    eventId: string,
    occurredOn: Date,
  ): PaymentTimeoutDomainEvent {
    return new PaymentTimeoutDomainEvent({
      paymentAttemptId: aggregateId,
      orderId: body.orderId as string,
      customerId: body.customerId as string,
      amount: body.amount as number,
      eventId,
      occurredOn,
    });
  }
}

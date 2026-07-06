import { ECDomainEvent } from "../../Shared/domain/ECDomainEvent.js";

/**
 * 決済プロバイダが与信を拒否した業務失敗。タイムアウト（無応答）とは別の失敗モードで、
 * reason には PSP が返す decline code（例: PROVIDER_UNAVAILABLE）をそのまま運ぶ。
 * デモシナリオ2（類似・準既知）の実トリガであり、Monitoring 側では過去の解決済み
 * プロバイダ障害事例との字句類似で「準・既知」に分類される。
 */
export class PaymentDeclinedDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = "ec.payment.declined";

  readonly orderId: string;
  readonly customerId: string;
  readonly amount: number;
  readonly reason: string;

  constructor(params: {
    paymentAttemptId: string;
    orderId: string;
    customerId: string;
    amount: number;
    reason: string;
    eventId?: string;
    occurredOn?: Date;
  }) {
    super({
      eventName: PaymentDeclinedDomainEvent.EVENT_NAME,
      aggregateId: params.paymentAttemptId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
    this.orderId = params.orderId;
    this.customerId = params.customerId;
    this.amount = params.amount;
    this.reason = params.reason;
  }

  toPrimitives(): Record<string, unknown> {
    return {
      orderId: this.orderId,
      customerId: this.customerId,
      amount: this.amount,
      reason: this.reason,
    };
  }

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): PaymentDeclinedDomainEvent {
    return new PaymentDeclinedDomainEvent({
      paymentAttemptId: params.aggregateId,
      orderId: params.attributes.orderId as string,
      customerId: params.attributes.customerId as string,
      amount: params.attributes.amount as number,
      reason: params.attributes.reason as string,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
  }
}

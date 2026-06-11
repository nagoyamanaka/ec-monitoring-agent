import { randomUUID } from "crypto";

export abstract class DomainEvent {
  static readonly EVENT_NAME: string;

  readonly eventName: string;
  readonly aggregateId: string;
  readonly eventId: string;
  readonly occurredOn: Date;

  constructor(params: {
    eventName: string;
    aggregateId: string;
    eventId?: string;
    occurredOn?: Date;
  }) {
    this.eventName = params.eventName;
    this.aggregateId = params.aggregateId;
    this.eventId = params.eventId ?? randomUUID();
    this.occurredOn = params.occurredOn ?? new Date();
  }

  abstract toPrimitives(): Record<string, unknown>;

  static fromPrimitives(
    _aggregateId: string,
    _body: Record<string, unknown>,
    _eventId: string,
    _occurredOn: Date,
  ): DomainEvent {
    throw new Error("fromPrimitives must be implemented in subclass");
  }
}

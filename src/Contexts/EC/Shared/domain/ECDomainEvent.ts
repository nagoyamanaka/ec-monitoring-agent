import { DomainEvent } from "../../../Shared/domain/DomainEvent.js";

export abstract class ECDomainEvent extends DomainEvent {
  constructor(params: {
    eventName: string;
    aggregateId: string;
    eventId?: string;
    occurredOn?: Date;
  }) {
    if (!params.eventName.startsWith("ec.")) {
      throw new Error(`ECDomainEvent name must start with 'ec.', got: ${params.eventName}`);
    }
    super(params);
  }
}

import { DomainEvent } from "../../../Shared/domain/DomainEvent.js";
import { InvalidDomainEventNameError } from "../../../Shared/domain/errors/InvalidDomainEventNameError.js";

export abstract class ECDomainEvent extends DomainEvent {
  constructor(params: {
    eventName: string;
    aggregateId: string;
    eventId?: string;
    occurredOn?: Date;
  }) {
    if (!params.eventName.startsWith("ec.")) {
      throw new InvalidDomainEventNameError("ec.", params.eventName);
    }
    super(params);
  }
}

import { DomainEventClass } from '../../domain/DomainEvent.js';
import { DomainEventSubscribers } from './DomainEventSubscribers.js';

type DomainEventJSON = {
  type: string;
  aggregateId: string;
  attributes: Record<string, unknown>;
  id: string;
  occurred_on: string;
};

export class DomainEventDeserializer extends Map<string, DomainEventClass> {
  static configure(subscribers: DomainEventSubscribers) {
    const mapping = new DomainEventDeserializer();
    subscribers.items.forEach(subscriber => {
      subscriber.subscribedTo().forEach(mapping.registerEvent.bind(mapping));
    });

    return mapping;
  }

  private registerEvent(domainEvent: DomainEventClass) {
    const eventName = domainEvent.EVENT_NAME;
    this.set(eventName, domainEvent);
  }

  deserialize(event: string) {
    const eventData = JSON.parse(event).data as DomainEventJSON;
    const { type, aggregateId, attributes, id, occurred_on } = eventData;
    const eventClass = super.get(type);

    if (!eventClass) {
      throw Error(`DomainEvent mapping not found for event ${type}`);
    }

    return eventClass.fromPrimitives({
      aggregateId,
      attributes,
      occurredOn: new Date(occurred_on),
      eventId: id
    });
  }
}

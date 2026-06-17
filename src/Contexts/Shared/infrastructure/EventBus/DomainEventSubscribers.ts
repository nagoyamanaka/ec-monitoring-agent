import { DomainEvent } from '../../domain/DomainEvent.js';
import { DomainEventSubscriber } from '../../domain/DomainEventSubscriber.js';

export class DomainEventSubscribers {
  constructor(public items: Array<DomainEventSubscriber<DomainEvent>>) {}
}

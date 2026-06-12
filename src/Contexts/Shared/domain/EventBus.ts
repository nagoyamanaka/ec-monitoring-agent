import { DomainEventSubscribers } from "../infrastructure/EventBus/DomainEventSubscribers";
import { DomainEvent } from "./DomainEvent.js";

export interface EventBus {
  publish(events: Array<DomainEvent>): Promise<void>;
  addSubscribers(subscribers: DomainEventSubscribers): void;
}

import { DomainEvent } from "./DomainEvent.js";

export interface EventBus {
  publish(events: DomainEvent[]): Promise<void>;
}

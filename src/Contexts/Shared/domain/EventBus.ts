import { DomainEvent } from "./DomainEvent.js";

export interface EventBus {
  publish(events: Array<DomainEvent>): Promise<void>;
}

import { DomainEvent } from "../../../domain/DomainEvent.js";
import { EventBus } from "../../../domain/EventBus.js";

// TODO(Step3): Implement Failover Publisher pattern (CodelyTV準拠)
// - Primary: publish to RabbitMQ exchange
// - Failover: persist to MongoDB outbox on connection failure
// - Retry: background job reads outbox and republishes
export class RabbitMqEventBus implements EventBus {
  async publish(_events: DomainEvent[]): Promise<void> {
    throw new Error("Not implemented");
  }
}

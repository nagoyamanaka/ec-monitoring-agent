import { DomainEvent } from '../../../domain/DomainEvent.js';
import { DomainEventSubscriber } from '../../../domain/DomainEventSubscriber.js';
import { DomainEventDeserializer } from '../DomainEventDeserializer.js';
import { RabbitMqConnection } from './RabbitMqConnection.js';
import { RabbitMQConsumer } from './RabbitMQConsumer.js';

export class RabbitMQConsumerFactory {
  constructor(
    private deserializer: DomainEventDeserializer,
    private connection: RabbitMqConnection,
    private maxRetries: Number
  ) {}

  build(subscriber: DomainEventSubscriber<DomainEvent>, exchange: string, queueName: string) {
    return new RabbitMQConsumer({
      subscriber,
      deserializer: this.deserializer,
      connection: this.connection,
      queueName,
      exchange,
      maxRetries: this.maxRetries
    });
  }
}

import { DomainEvent } from '../../../domain/DomainEvent.js';
import { EventBus } from '../../../domain/EventBus.js';
import { DomainEventDeserializer } from '../DomainEventDeserializer.js';
import { DomainEventFailoverPublisher } from '../DomainEventFailoverPublisher/DomainEventFailoverPublisher.js';
import { DomainEventJsonSerializer } from '../DomainEventJsonSerializer.js';
import { DomainEventSubscribers } from '../DomainEventSubscribers.js';
import { RabbitMqConnection } from './RabbitMqConnection.js';
import { RabbitMQConsumerFactory } from './RabbitMQConsumerFactory.js';
import { RabbitMQqueueFormatter } from './RabbitMQqueueFormatter.js';

export class RabbitMQEventBus implements EventBus {
  private failoverPublisher: DomainEventFailoverPublisher;
  private connection: RabbitMqConnection;
  private exchange: string;
  private queueNameFormatter: RabbitMQqueueFormatter;
  private maxRetries: Number;

  constructor(params: {
    failoverPublisher: DomainEventFailoverPublisher;
    connection: RabbitMqConnection;
    exchange: string;
    queueNameFormatter: RabbitMQqueueFormatter;
    maxRetries: Number;
  }) {
    const { failoverPublisher, connection, exchange } = params;
    this.failoverPublisher = failoverPublisher;
    this.connection = connection;
    this.exchange = exchange;
    this.queueNameFormatter = params.queueNameFormatter;
    this.maxRetries = params.maxRetries;
  }

  async addSubscribers(subscribers: DomainEventSubscribers): Promise<void> {
    const deserializer = DomainEventDeserializer.configure(subscribers);
    const consumerFactory = new RabbitMQConsumerFactory(deserializer, this.connection, this.maxRetries);

    for (const subscriber of subscribers.items) {
      const queueName = this.queueNameFormatter.format(subscriber);
      const rabbitMQConsumer = consumerFactory.build(subscriber, this.exchange, queueName);

      await this.connection.consume(queueName, rabbitMQConsumer.onMessage.bind(rabbitMQConsumer));
    }
  }

  async publish(events: Array<DomainEvent>): Promise<void> {
    for (const event of events) {
      try {
        const routingKey = event.eventName;
        const content = this.toBuffer(event);
        const options = this.options(event);

        await this.connection.publish({ exchange: this.exchange, routingKey, content, options });
      } catch (error: any) {
        await this.failoverPublisher.publish(event);
      }
    }
  }

  private options(event: DomainEvent) {
    return {
      messageId: event.eventId,
      contentType: 'application/json',
      contentEncoding: 'utf-8'
    };
  }

  private toBuffer(event: DomainEvent): Buffer {
    const eventPrimitives = DomainEventJsonSerializer.serialize(event);

    return Buffer.from(eventPrimitives);
  }
}

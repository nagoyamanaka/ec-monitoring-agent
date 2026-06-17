import { ConsumeMessage } from 'amqplib';
import { DomainEvent } from '../../../domain/DomainEvent.js';
import { DomainEventSubscriber } from '../../../domain/DomainEventSubscriber.js';
import { DomainEventDeserializer } from '../DomainEventDeserializer.js';
import { RabbitMqConnection } from './RabbitMqConnection.js';

export class RabbitMQConsumer {
  private subscriber: DomainEventSubscriber<DomainEvent>;
  private deserializer: DomainEventDeserializer;
  private connection: RabbitMqConnection;
  private maxRetries: number;
  private queueName: string;
  private exchange: string;

  constructor(params: {
    subscriber: DomainEventSubscriber<DomainEvent>;
    deserializer: DomainEventDeserializer;
    connection: RabbitMqConnection;
    queueName: string;
    exchange: string;
    maxRetries: number;
  }) {
    this.subscriber = params.subscriber;
    this.deserializer = params.deserializer;
    this.connection = params.connection;
    this.maxRetries = params.maxRetries;
    this.queueName = params.queueName;
    this.exchange = params.exchange;
  }

  async onMessage(message: ConsumeMessage) {
    const content = message.content.toString();
    const domainEvent = this.deserializer.deserialize(content);

    try {
      await this.subscriber.on(domainEvent);
    } catch (error) {
      await this.handleError(message);
    } finally {
      this.connection.ack(message);
    }
  }

  private async handleError(message: ConsumeMessage) {
    if (this.hasBeenRedeliveredTooMuch(message)) {
      await this.deadLetter(message);
    } else {
      await this.retry(message);
    }
  }

  private async retry(message: ConsumeMessage) {
    await this.connection.retry({ message, queue: this.queueName, exchange: this.exchange });
  }

  private async deadLetter(message: ConsumeMessage) {
    await this.connection.deadLetter({ message, queue: this.queueName, exchange: this.exchange });
  }

  private hasBeenRedeliveredTooMuch(message: ConsumeMessage) {
    if (this.hasBeenRedelivered(message)) {
      const count = parseInt(message.properties.headers?.['redelivery_count'] as string);
      return count >= this.maxRetries;
    }
    return false;
  }

  private hasBeenRedelivered(message: ConsumeMessage) {
    return message.properties.headers?.['redelivery_count'] !== undefined;
  }
}

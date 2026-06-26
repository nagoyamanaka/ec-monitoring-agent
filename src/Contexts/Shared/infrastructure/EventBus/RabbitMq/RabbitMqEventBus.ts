import { DomainEvent } from '../../../domain/DomainEvent.js';
import { EventBus } from '../../../domain/EventBus.js';
import { DomainEventDeserializer } from '../DomainEventDeserializer.js';
import { DomainEventFailoverPublisher } from '../DomainEventFailoverPublisher/DomainEventFailoverPublisher.js';
import { DomainEventJsonSerializer } from '../DomainEventJsonSerializer.js';
import { DomainEventSubscribers } from '../DomainEventSubscribers.js';
import { RabbitMqConnection } from './RabbitMqConnection.js';
import { RabbitMQConsumerFactory } from './RabbitMQConsumerFactory.js';
import { RabbitMQQueueNameFormatter } from './RabbitMQQueueNameFormatter.js';

export class RabbitMQEventBus implements EventBus {
  private failoverPublisher: DomainEventFailoverPublisher;
  private connection: RabbitMqConnection;
  private exchange: string;
  private queueNameFormatter: RabbitMQQueueNameFormatter;
  private maxRetries: number;

  constructor(params: {
    failoverPublisher: DomainEventFailoverPublisher;
    connection: RabbitMqConnection;
    exchange: string;
    queueNameFormatter: RabbitMQQueueNameFormatter;
    maxRetries: number;
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

  /**
   * 切断中に failover(Mongo) へ退避したイベントを RabbitMQ へ再送する。
   * 起動時と再接続成功直後に呼ぶことで「切断中に publish できなかったイベント」を取りこぼさない。
   * - 再送成功した分だけ failover から削除する（at-least-once：messageId=eventId なので重複は下流で dedup 可能）
   * - 1件でも再送に失敗したら（＝まだ繋がっていない）そこで止め、残りは次回ドレインに回す
   */
  async drainFailover(): Promise<{ drained: number; remaining: number }> {
    const pending = await this.failoverPublisher.pending();
    let drained = 0;

    for (const item of pending) {
      try {
        await this.connection.publish({
          exchange: this.exchange,
          routingKey: item.eventName,
          content: Buffer.from(item.content),
          options: {
            messageId: item.eventId,
            contentType: "application/json",
            contentEncoding: "utf-8",
          },
        });
        await this.failoverPublisher.remove(item.eventId);
        drained += 1;
      } catch {
        // まだ RabbitMQ に繋がっていない。残りは退避したまま次回に委ねる。
        break;
      }
    }

    return { drained, remaining: pending.length - drained };
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

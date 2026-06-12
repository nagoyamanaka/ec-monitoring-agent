import { DomainEvent } from "../../../domain/DomainEvent.js";
import { DomainEventSubscriber } from "../../../domain/DomainEventSubscriber.js";
import { RabbitMqConnection } from "./RabbitMqConnection.js";
import { RabbitMQExchangeNameFormatter } from "./RabbitMQExchangeNameFormatter.js";
import { RabbitMQqueueFormatter } from "./RabbitMQqueueFormatter.js";

export class RabbitMQConfigurer {
  constructor(
    private connection: RabbitMqConnection,
    private queueNameFormatter: RabbitMQqueueFormatter,
    private messageRetryTtl: number,
  ) {}

  async configure(params: {
    exchange: string;
    subscribers: Array<DomainEventSubscriber<DomainEvent>>;
  }): Promise<void> {
    // Exchange
    const retryExchange = RabbitMQExchangeNameFormatter.retry(params.exchange);
    const deadLetterExchange = RabbitMQExchangeNameFormatter.deadLetter(
      params.exchange,
    );

    await this.connection.exchange({ name: params.exchange });
    await this.connection.exchange({ name: retryExchange });
    await this.connection.exchange({ name: deadLetterExchange });

    for (const subscriber of params.subscribers) {
      await this.addQueue(subscriber, params.exchange);
    }
  }

  private async addQueue(
    subscriber: DomainEventSubscriber<DomainEvent>,
    exchange: string,
  ) {
    // Exchange
    const retryExchange = RabbitMQExchangeNameFormatter.retry(exchange);
    const deadLetterExchange =
      RabbitMQExchangeNameFormatter.deadLetter(exchange);

    // Routing Key
    const routingKeys = this.getRoutingKeysFor(subscriber);

    // Queue
    const queue = this.queueNameFormatter.format(subscriber);
    const deadLetterQueue =
      this.queueNameFormatter.formatDeadLetter(subscriber);
    const retryQueue = this.queueNameFormatter.formatRetry(subscriber);

    // 通常キュー
    await this.connection.queue({ routingKeys, name: queue, exchange });
    // リトライキュー
    await this.connection.queue({
      routingKeys: [queue],
      name: retryQueue,
      exchange: retryExchange,
      messageTtl: this.messageRetryTtl,
      deadLetterExchange: exchange,
      deadLetterQueue: queue,
    });
    // DLQキュー
    await this.connection.queue({
      routingKeys: [queue],
      name: deadLetterQueue,
      exchange: deadLetterExchange,
    });
  }

  private getRoutingKeysFor(subscriber: DomainEventSubscriber<DomainEvent>) {
    // イベントネームで呼び出せるように(間接型)：方法1
    const routingKeys = subscriber
      .subscribedTo()
      .map((event) => event.EVENT_NAME);

    // キューで呼び出せるように(直接型): 方法2
    const queue = this.queueNameFormatter.format(subscriber);
    routingKeys.push(queue);

    return routingKeys;
  }
}

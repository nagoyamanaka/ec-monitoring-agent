import { DomainEvent } from "../../../domain/DomainEvent.js";
import { DomainEventSubscriber } from "../../../domain/DomainEventSubscriber.js";

// キューの名前フォーマットというけど、実質subscriber用のroutingKey生成器
// RabbitMqConfigure.tsのgetRoutingKeysFor()を見ると、イベント用のroutingKeyは直接domainEvent名で作ってる。
// なのでこのクラスは実質subscriberの名前でexchgangeにrouting keyを登録したい(別ルート)だけ
export class RabbitMQqueueFormatter {
  constructor(private moduleName: string) {}

  format(subscriber: DomainEventSubscriber<DomainEvent>) {
    const value = subscriber.constructor.name;
    const name = value
      .split(/(?=[A-Z])/) // ?=...)肯定的先読み。直後に...が続く位置を探す
      .join("_")
      .toLowerCase();
    return `${this.moduleName}.${name}`;
  }

  formatRetry(subscriber: DomainEventSubscriber<DomainEvent>) {
    const name = this.format(subscriber);
    return `retry.${name}`;
  }

  formatDeadLetter(subscriber: DomainEventSubscriber<DomainEvent>) {
    const name = this.format(subscriber);
    return `dead_letter.${name}`;
  }
}

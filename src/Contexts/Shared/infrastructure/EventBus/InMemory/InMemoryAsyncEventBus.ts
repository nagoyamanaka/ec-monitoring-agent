import { EventEmitter } from "events";
import { DomainEvent } from "../../../domain/DomainEvent.js";
import { EventBus } from "../../../domain/EventBus.js";
import { DomainEventSubscribers } from "../DomainEventSubscribers.js";

// メモリ内だけで完結するイベントバス
// メッセージブローカーのテスト・開発用の簡易実装
export class InMemoryAsyncEventBus extends EventEmitter implements EventBus {
  async publish(events: DomainEvent[]): Promise<void> {
    // このEventBusインスタンスに登録されている、eventNameに紐づくリスナー前部に対して通知する
    // InMemoryAsyncEventBus (EventEmitter)
    // ├── "UserCreated" → [subscriberA.on]
    // ├── "UserCreated" → [subscriberB.on]
    // └── "OrderPaid"   → [subscriberC.on]
    // emit = 登録されたリスナーを起動
    events.map((event) => this.emit(event.eventName, event));
  }

  addSubscribers(subscribers: DomainEventSubscribers) {
    subscribers.items.forEach((subscriber) => {
      subscriber.subscribedTo().forEach((event) => {
        // このEventBusに対して、EVENT_NAMEのイベントが発火したらsubscriber.onを実行するように登録
        // on = リスナー登録
        this.on(event.EVENT_NAME, subscriber.on.bind(subscriber));
      });
    });
  }
}

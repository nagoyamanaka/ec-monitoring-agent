import { Collection, MongoClient } from 'mongodb';
import { DomainEvent } from '../../../domain/DomainEvent.js';
import { DomainEventDeserializer } from '../DomainEventDeserializer.js';
import { DomainEventJsonSerializer } from '../DomainEventJsonSerializer.js';

export class DomainEventFailoverPublisher {
  static collectionName = 'DomainEvents';

  constructor(private client: Promise<MongoClient>, private deserializer?: DomainEventDeserializer) {}

  protected async collection(): Promise<Collection> {
    return (await this.client).db().collection(DomainEventFailoverPublisher.collectionName);
  }

  setDeserializer(deserializer: DomainEventDeserializer) {
    this.deserializer = deserializer;
  }

  async publish(event: DomainEvent): Promise<void> {
    const collection = await this.collection();

    const eventSerialized = DomainEventJsonSerializer.serialize(event);
    const options = { upsert: true };
    const update = { $set: { eventId: event.eventId, event: eventSerialized } };

    await collection.updateOne({ eventId: event.eventId }, update, options);
  }

  async consume(): Promise<Array<DomainEvent>> {
    const collection = await this.collection();
    const documents = await collection.find().limit(200).toArray();
    if (!this.deserializer) {
      throw new Error('Deserializer has not been set yet');
    }

    const events = documents.map(document => this.deserializer!.deserialize(document.event));

    return events.filter(Boolean) as Array<DomainEvent>;
  }

  /**
   * ドレイン用に退避イベントを「生のまま」取り出す。
   * deserialize は使わない：退避するのは publish 側アプリで、その deserializer は
   * 自分が subscribe するイベントしか知らない（publish するイベントは未登録なことが多い）。
   * 保存済みの serialized 文字列をそのまま再送できるよう、routingKey に使う eventName だけを
   * JSON から抜き出して返す。
   */
  async pending(limit = 200): Promise<Array<PendingFailoverEvent>> {
    const collection = await this.collection();
    const documents = await collection.find().limit(limit).toArray();

    const pending: PendingFailoverEvent[] = [];
    for (const document of documents) {
      const content = document.event as string;
      try {
        const eventName = JSON.parse(content)?.data?.type as string | undefined;
        if (!eventName) continue; // routingKey が取れないものは送れないので残す
        pending.push({ eventId: document.eventId as string, eventName, content });
      } catch {
        // 壊れた1件で全体を止めない（残置して次回再評価）
      }
    }
    return pending;
  }

  /** 再送成功した退避イベントを削除する。 */
  async remove(eventId: string): Promise<void> {
    const collection = await this.collection();
    await collection.deleteOne({ eventId });
  }
}

/** ドレイン時に再送するために必要な最小情報（生の serialized 文字列＋routingKey）。 */
export type PendingFailoverEvent = {
  readonly eventId: string;
  readonly eventName: string;
  readonly content: string;
};

import { describe, it, expect, beforeEach } from "vitest";
import { RabbitMQEventBus } from "./RabbitMqEventBus.js";
import { RabbitMqConnection } from "./RabbitMqConnection.js";
import { RabbitMQQueueNameFormatter } from "./RabbitMQQueueNameFormatter.js";
import {
  DomainEventFailoverPublisher,
  PendingFailoverEvent,
} from "../DomainEventFailoverPublisher/DomainEventFailoverPublisher.js";

const EXCHANGE = "test_exchange";

// 退避済みイベントを保持し、pending()/remove() だけを再現する fake。
class FakeFailoverPublisher {
  private store: PendingFailoverEvent[];

  constructor(initial: PendingFailoverEvent[]) {
    this.store = [...initial];
  }

  async pending(): Promise<PendingFailoverEvent[]> {
    return [...this.store];
  }

  async remove(eventId: string): Promise<void> {
    this.store = this.store.filter((e) => e.eventId !== eventId);
  }

  get remaining(): PendingFailoverEvent[] {
    return this.store;
  }
}

// publish() のみを再現する connection fake。failAfter 件目以降は失敗させ「まだ未接続」を模す。
class FakeConnection {
  readonly published: Array<{ routingKey: string; messageId: string; content: string }> = [];

  constructor(private readonly failFrom = Number.POSITIVE_INFINITY) {}

  async publish(params: {
    exchange: string;
    routingKey: string;
    content: Buffer;
    options: { messageId: string };
  }): Promise<void> {
    if (this.published.length >= this.failFrom) {
      throw new Error("RabbitMQ unavailable");
    }
    this.published.push({
      routingKey: params.routingKey,
      messageId: params.options.messageId,
      content: params.content.toString(),
    });
  }
}

const pendingEvent = (id: string, type: string): PendingFailoverEvent => ({
  eventId: id,
  eventName: type,
  content: JSON.stringify({ data: { id, type, attributes: {} } }),
});

const buildBus = (failover: FakeFailoverPublisher, connection: FakeConnection) =>
  new RabbitMQEventBus({
    failoverPublisher: failover as unknown as DomainEventFailoverPublisher,
    connection: connection as unknown as RabbitMqConnection,
    exchange: EXCHANGE,
    queueNameFormatter: new RabbitMQQueueNameFormatter("test"),
    maxRetries: 3,
  });

describe("RabbitMQEventBus.drainFailover", () => {
  let failover: FakeFailoverPublisher;

  beforeEach(() => {
    failover = new FakeFailoverPublisher([
      pendingEvent("e1", "ec.payment.timeout"),
      pendingEvent("e2", "ec.inventory.reservation_failed"),
    ]);
  });

  it("退避イベントを生の content のまま再送し、eventName を routingKey に使う", async () => {
    const connection = new FakeConnection();
    const bus = buildBus(failover, connection);

    const result = await bus.drainFailover();

    expect(result).toEqual({ drained: 2, remaining: 0 });
    expect(connection.published.map((p) => p.routingKey)).toEqual([
      "ec.payment.timeout",
      "ec.inventory.reservation_failed",
    ]);
    // messageId は eventId・content は保存文字列そのまま（deserialize を介さない）。
    expect(connection.published[0].messageId).toBe("e1");
    expect(connection.published[0].content).toBe(
      JSON.stringify({ data: { id: "e1", type: "ec.payment.timeout", attributes: {} } }),
    );
  });

  it("再送成功した分だけ failover から削除する", async () => {
    const connection = new FakeConnection();
    const bus = buildBus(failover, connection);

    await bus.drainFailover();

    expect(failover.remaining).toEqual([]);
  });

  it("途中で publish が失敗したら止め、残りは退避したまま次回に回す", async () => {
    const connection = new FakeConnection(1); // 2件目で失敗
    const bus = buildBus(failover, connection);

    const result = await bus.drainFailover();

    expect(result).toEqual({ drained: 1, remaining: 1 });
    expect(connection.published).toHaveLength(1);
    // 成功した e1 のみ削除され、未送の e2 は残る（取りこぼさない）。
    expect(failover.remaining.map((e) => e.eventId)).toEqual(["e2"]);
  });

  it("退避が空なら何もしない", async () => {
    const connection = new FakeConnection();
    const bus = buildBus(new FakeFailoverPublisher([]), connection);

    const result = await bus.drainFailover();

    expect(result).toEqual({ drained: 0, remaining: 0 });
    expect(connection.published).toHaveLength(0);
  });
});

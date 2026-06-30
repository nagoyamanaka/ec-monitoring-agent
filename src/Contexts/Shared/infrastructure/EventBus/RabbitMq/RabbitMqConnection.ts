import amqplib, { ConsumeMessage } from "amqplib";
import { Logger } from "../../../domain/logging/Logger.js";
import { ConnectionSettings } from "./ConnectionSettings.js";
import { RabbitMQExchangeNameFormatter } from "./RabbitMQExchangeNameFormatter.js";

export class RabbitMqConnection {
  private static readonly SERVICE = "rabbitmq-connection";
  private static readonly RECONNECT_BASE_MS = 1_000;
  private static readonly RECONNECT_MAX_MS = 30_000;

  private connectionSettings: ConnectionSettings;
  private channel?: amqplib.ConfirmChannel;
  private connection?: amqplib.ChannelModel;
  private logger?: Logger;
  /**
   * channel の prefetch（未 ack のまま同時に配信を受ける上限）。
   * 1 だと1メッセージを ack するまで次が一切配信されず、長時間ハンドラ（AI調査 ~100秒）が
   * 全キューの処理を止める（ヘッドオブラインブロッキング）。完了後 ack（at-least-once）を保ったまま
   * 並列度を上げるため設定可能にする。既定 1（従来挙動）。
   */
  private prefetchCount: number;

  /** stop() による意図的クローズか。true の間は再接続しない。 */
  private closing = false;
  /** 再接続ループが走行中か（多重起動防止）。 */
  private reconnecting = false;
  /**
   * 再接続成功後に呼ぶ再セットアップ（exchange/queue 再宣言 + consumer 再登録）。
   * 切断時は channel ごと作り直されるため、購読は必ず張り直す必要がある。
   */
  private reestablish?: () => Promise<void>;

  constructor(params: {
    connectionSettings: ConnectionSettings;
    logger?: Logger;
    prefetchCount?: number;
  }) {
    this.connectionSettings = params.connectionSettings;
    this.logger = params.logger;
    this.prefetchCount = Math.max(1, params.prefetchCount ?? 1);
  }

  /**
   * 再接続成功後に実行する再セットアップ手順を登録する。
   * 典型的には RabbitMQConfigurer.configure（exchange/queue 再宣言）＋ eventBus.addSubscribers（consumer 再登録）。
   * 切断後に新しい channel には consumer が一切載っていないため、これを張り直さないと購読が永久に止まる。
   */
  onReestablished(handler: () => Promise<void>) {
    this.reestablish = handler;
  }

  async connect() {
    this.connection = await this.amqpConnect();
    this.channel = await this.amqpChannel();
  }

  async exchange(params: { name: string }) {
    return await this.channel?.assertExchange(params.name, "topic", {
      durable: true,
    });
  }

  async queue(params: {
    exchange: string;
    name: string;
    routingKeys: string[]; // メッセージに貼られる「ラベル」。Exchangeはラベルを見て、対象のQueueに配送
    deadLetterExchange?: string;
    deadLetterQueue?: string;
    messageTtl?: number;
  }) {
    // rabbitMQが再起動しても、queueの設定を保存し続ける
    const durable = true;
    // 特定のconnection単位にのみ依存しないように
    const exclusive = false;
    // consumerが一人でも読んだら消すかどうか。今回は消さない
    const autoDelete = false;
    const args = this.getQueueArguments(params);

    await this.channel?.assertQueue(params.name, {
      exclusive,
      durable,
      autoDelete,
      arguments: args,
    });
    for (const routingKey of params.routingKeys) {
      // exchangeとqueueをつなぐルール
      // params.nameがQueueの名前。
      // exchangeに設定されたroutingKeyに該当するmessageが届くと、対応するQueueに送られる
      await this.channel!.bindQueue(params.name, params.exchange, routingKey);
    }
  }

  private getQueueArguments(params: {
    deadLetterExchange?: string;
    deadLetterQueue?: string;
    messageTtl?: number;
  }): Record<string, unknown> {
    let args: Record<string, unknown> = {};
    if (params.deadLetterExchange) {
      args = { ...args, "x-dead-letter-exchange": params.deadLetterExchange };
    }
    if (params.deadLetterQueue) {
      args = { ...args, "x-dead-letter-routing-key": params.deadLetterQueue };
    }
    if (params.messageTtl) {
      args = { ...args, "x-message-ttl": params.messageTtl };
    }

    return args;
  }

  async deleteQueue(queue: string) {
    return await this.channel!.deleteQueue(queue);
  }

  private async amqpConnect(): Promise<amqplib.ChannelModel> {
    const { hostname, port, secure } = this.connectionSettings.connection;
    const { username, password, vhost } = this.connectionSettings;
    const protocol = secure ? "amqps" : "amqp";

    const connection = await amqplib.connect({
      protocol,
      hostname,
      port,
      username,
      password,
      vhost,
    });

    // "error" は close の直前に出ることが多い。ここでは記録のみ（再接続は "close" で駆動）。
    connection.on("error", (err: Error) => {
      void this.logger?.warn({
        service: RabbitMqConnection.SERVICE,
        action: "rabbitmq_connection_error",
        message: `RabbitMQ 接続エラー：${err.message}`,
        stack_trace: err.stack,
      });
    });

    // 切断（RabbitMQ 再起動・ネットワーク断など）を検知して再接続ループを起動する。
    // これが無いと一度の瞬断で publish は failover(Mongo) に落ち続け、consumer は永久に 0 になる。
    connection.on("close", () => {
      if (this.closing) return; // stop() 由来の意図的クローズ
      void this.logger?.warn({
        service: RabbitMqConnection.SERVICE,
        action: "rabbitmq_connection_closed",
        message: "RabbitMQ 接続が切断されました。再接続を試みます。",
      });
      this.scheduleReconnect();
    });

    return connection;
  }

  /** 切断検知時に一度だけ再接続ループを起動する（多重起動はガード）。 */
  private scheduleReconnect() {
    if (this.reconnecting || this.closing) return;
    this.reconnecting = true;
    void this.reconnectLoop();
  }

  /** 指数バックオフで再接続し、成功したら再セットアップ（exchange/queue/consumer）を張り直す。 */
  private async reconnectLoop() {
    let delay = RabbitMqConnection.RECONNECT_BASE_MS;
    let attempt = 0;

    while (!this.closing) {
      await this.sleep(delay);
      if (this.closing) break;
      attempt += 1;

      try {
        await this.connect();
        await this.reestablish?.();
        await this.logger?.info({
          service: RabbitMqConnection.SERVICE,
          action: "rabbitmq_reconnected",
          message: `RabbitMQ へ再接続し購読を復旧しました（${attempt} 回目で成功）。`,
          retry_count: attempt,
        });
        this.reconnecting = false;
        return;
      } catch (err) {
        await this.logger?.warn({
          service: RabbitMqConnection.SERVICE,
          action: "rabbitmq_reconnect_failed",
          message: `RabbitMQ 再接続に失敗（${attempt} 回目）。${delay}ms 後に再試行します。`,
          retry_count: attempt,
          stack_trace: err instanceof Error ? err.stack : String(err),
        });
        // 部分的に張った接続が残っていれば破棄してから次の試行へ（接続リーク防止）。
        await this.discardConnectionQuietly();
        delay = Math.min(delay * 2, RabbitMqConnection.RECONNECT_MAX_MS);
      }
    }

    this.reconnecting = false;
  }

  /** 再試行前に中途半端な接続を静かに閉じる。close() のフラグは触らない。 */
  private async discardConnectionQuietly() {
    try {
      await this.connection?.close();
    } catch {
      // 既に死んでいる接続を閉じる際のエラーは無視する。
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async amqpChannel(): Promise<amqplib.ConfirmChannel> {
    const channel = await this.connection!.createConfirmChannel();
    await channel.prefetch(this.prefetchCount);

    return channel;
  }

  async publish(params: {
    exchange: string;
    routingKey: string;
    content: Buffer;
    options: {
      messageId: string;
      contentType: string;
      contentEncoding: string;
      priority?: number;
      headers?: Record<string, unknown>;
    };
  }) {
    const { routingKey, content, options, exchange } = params;

    return new Promise<void>((resolve, reject) => {
      this.channel!.publish(
        exchange,
        routingKey,
        content,
        options,
        (error: Error | null) => (error ? reject(error) : resolve()),
      );
    });
  }

  async close() {
    // 意図的クローズ。"close" イベント由来の再接続を抑止する。
    this.closing = true;
    await this.channel?.close();
    return await this.connection?.close();
  }

  async consume(queue: string, onMessage: (message: ConsumeMessage) => void) {
    await this.channel!.consume(queue, (message: ConsumeMessage | null) => {
      if (!message) {
        return;
      }
      onMessage(message);
    });
  }

  ack(message: ConsumeMessage) {
    this.channel!.ack(message);
  }

  async retry(params: { message: ConsumeMessage; queue: string; exchange: string }) {
    const retryExchange = RabbitMQExchangeNameFormatter.retry(params.exchange);
    const options = this.getMessageOptions(params.message);

    return await this.publish({
      exchange: retryExchange,
      routingKey: params.queue,
      content: params.message.content,
      options,
    });
  }

  async deadLetter(params: { message: ConsumeMessage; queue: string; exchange: string }) {
    const deadLetterExchange = RabbitMQExchangeNameFormatter.deadLetter(params.exchange);
    const options = this.getMessageOptions(params.message);

    return await this.publish({
      exchange: deadLetterExchange,
      routingKey: params.queue,
      content: params.message.content,
      options,
    });
  }

  private getMessageOptions(message: ConsumeMessage) {
    const { messageId, contentType, contentEncoding, priority } = message.properties;
    return {
      messageId,
      headers: this.incrementRedeliveryCount(message),
      contentType,
      contentEncoding,
      priority,
    };
  }

  private incrementRedeliveryCount(message: ConsumeMessage): Record<string, unknown> {
    const headers: Record<string, unknown> = message.properties.headers ?? {};
    if (this.hasBeenRedelivered(message)) {
      const count = parseInt(headers["redelivery_count"] as string);
      headers["redelivery_count"] = count + 1;
    } else {
      headers["redelivery_count"] = 1;
    }
    return headers;
  }

  private hasBeenRedelivered(message: ConsumeMessage): boolean {
    return message.properties.headers?.["redelivery_count"] !== undefined;
  }
}

import { Redis } from "ioredis";
import {
  ValkeyConnection,
  ValkeyMessageHandler,
} from "./ValkeyConnection.js";

/**
 * ioredis 実装。コマンド接続（KV + publish）と購読接続を分ける（Redis の subscribe モードは
 * 通常コマンドを発行できないため）。購読接続は最初の subscribe() で遅延生成する。
 *
 * Valkey 障害は best-effort（§11.3）: 失敗しても投げず（publish/projection は劣化として握りつぶし、
 * read-model は miss として Mongo 直読にフォールバックさせる）。SoT は Mongo 側にある前提。
 */
export class IoRedisValkeyConnection implements ValkeyConnection {
  readonly enabled = true;

  private readonly command: Redis;
  private subscriber: Redis | null = null;
  private readonly handlers = new Map<string, ValkeyMessageHandler[]>();

  constructor(url: string) {
    // lazyConnect: 構築では接続せず最初のコマンドで張る（テスト/起動順序の都合）。
    // maxRetriesPerRequest=null で再接続中もコマンドを投げ続けられる（best-effort）。
    this.command = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
  }

  async get(key: string): Promise<string | null> {
    return this.command.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.command.set(key, value, "EX", ttlSeconds);
    } else {
      await this.command.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.command.del(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.command.publish(channel, message);
  }

  async subscribe(
    channels: string[],
    handler: ValkeyMessageHandler,
  ): Promise<void> {
    const subscriber = this.ensureSubscriber();
    for (const channel of channels) {
      const existing = this.handlers.get(channel);
      if (existing) {
        existing.push(handler);
      } else {
        this.handlers.set(channel, [handler]);
      }
    }
    await subscriber.subscribe(...channels);
  }

  async close(): Promise<void> {
    await this.command.quit();
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.handlers.clear();
  }

  private ensureSubscriber(): Redis {
    if (!this.subscriber) {
      // 購読接続はコマンド接続の設定を複製して張る（duplicate）。
      this.subscriber = this.command.duplicate();
      this.subscriber.on("message", (channel: string, message: string) => {
        for (const handler of this.handlers.get(channel) ?? []) {
          handler(channel, message);
        }
      });
    }
    return this.subscriber;
  }
}

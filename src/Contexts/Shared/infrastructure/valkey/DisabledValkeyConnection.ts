import {
  ValkeyConnection,
  ValkeyMessageHandler,
} from "./ValkeyConnection.js";

/**
 * REDIS_URL 未設定時の null object。すべて no-op で、read-model は常に miss（null）を返す。
 * これにより consumer（task17 notifier / task18 read-model store）は分岐なしで素通しでき、
 * in-process notifier / Mongo 直読の現状動作がそのまま残る。
 */
export class DisabledValkeyConnection implements ValkeyConnection {
  readonly enabled = false;

  async get(_key: string): Promise<string | null> {
    return null;
  }

  async set(_key: string, _value: string, _ttlSeconds?: number): Promise<void> {
    // no-op
  }

  async del(_key: string): Promise<void> {
    // no-op
  }

  async publish(_channel: string, _message: string): Promise<void> {
    // no-op
  }

  async subscribe(
    _channels: string[],
    _handler: ValkeyMessageHandler,
  ): Promise<void> {
    // no-op
  }

  async close(): Promise<void> {
    // no-op
  }
}

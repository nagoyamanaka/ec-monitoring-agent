import type { AlertPrimitives } from "../../domain/Alert.js";
import { ValkeyConnection } from "../../../../Shared/infrastructure/valkey/ValkeyConnection.js";
import { AlertReadModelStore } from "./AlertReadModelStore.js";

/**
 * Valkey 上の Alert read-model。AlertPrimitives を JSON で per-id / 一覧スナップショットに保持する。
 * 既定 TTL なし（projection は save 時の明示 upsert / invalidate で更新する＝結果整合）。
 * 壊れた JSON は miss 扱いにして Mongo フォールバックさせる（best-effort）。
 */
export class RedisAlertReadModelStore implements AlertReadModelStore {
  private static readonly ALERT_KEY_PREFIX = "monitoring:readmodel:alert:";
  private static readonly LIST_KEY = "monitoring:readmodel:alerts:all";

  constructor(
    private readonly valkey: ValkeyConnection,
    //　DB(SoT)との更新漏れを防ぐので最大xx秒のTTL設定
    private readonly ttlSeconds: number = 60,
  ) {}

  async getAlert(id: string): Promise<AlertPrimitives | null> {
    return this.read<AlertPrimitives>(this.alertKey(id));
  }

  async saveAlert(alert: AlertPrimitives): Promise<void> {
    await this.valkey.set(
      this.alertKey(alert.id),
      JSON.stringify(alert),
      this.ttlSeconds,
    );
  }

  async getList(): Promise<AlertPrimitives[] | null> {
    return this.read<AlertPrimitives[]>(RedisAlertReadModelStore.LIST_KEY);
  }

  async saveList(alerts: AlertPrimitives[]): Promise<void> {
    await this.valkey.set(
      RedisAlertReadModelStore.LIST_KEY,
      JSON.stringify(alerts),
      this.ttlSeconds,
    );
  }

  async invalidateList(): Promise<void> {
    await this.valkey.del(RedisAlertReadModelStore.LIST_KEY);
  }

  private alertKey(id: string): string {
    return RedisAlertReadModelStore.ALERT_KEY_PREFIX + id;
  }

  private async read<T>(key: string): Promise<T | null> {
    const raw = await this.valkey.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

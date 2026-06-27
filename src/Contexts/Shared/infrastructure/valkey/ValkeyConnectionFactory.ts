import { DisabledValkeyConnection } from "./DisabledValkeyConnection.js";
import { IoRedisValkeyConnection } from "./IoRedisValkeyConnection.js";
import { ValkeyConnection } from "./ValkeyConnection.js";

export type ValkeyConfig = { url: string };

/**
 * composition root から呼ぶ唯一の生成口。
 * url 空 → DisabledValkeyConnection（null object・no-op）でフォールバック（ローカル/テストは現状動作）。
 * url 設定 → IoRedisValkeyConnection（実接続）。
 */
export function createValkeyConnection(config: ValkeyConfig): ValkeyConnection {
  if (!config.url) {
    return new DisabledValkeyConnection();
  }
  return new IoRedisValkeyConnection(config.url);
}

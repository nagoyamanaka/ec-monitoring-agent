/**
 * Valkey（Redis 互換）接続の抽象。stretchⅠ ハイブリッド運用の足場。
 *
 * 二つの用途を1つの接続抽象に閉じる:
 *  - read-model KV（task18・cache-aside）: get / set / del
 *  - SSE Pub/Sub transport（task17・多インスタンス fan-out）: publish / subscribe
 *
 * 重要: Valkey は SoT ではなく「再構築可能な read-model projection ＋ Pub/Sub transport」。
 * 無効時（REDIS_URL 未設定）は DisabledValkeyConnection（null object）で no-op にフォールバックし、
 * in-process notifier / Mongo 直読の現状動作をそのまま維持する（障害を「障害」でなく「性能劣化」に縮める）。
 *
 * 実装は ioredis（IoRedisValkeyConnection）/ no-op（DisabledValkeyConnection）。
 * 生成は createValkeyConnection(config) に集約（composition root から呼ぶ）。
 */
export type ValkeyMessageHandler = (channel: string, message: string) => void;

export interface ValkeyConnection {
  /** REDIS_URL 設定済みで実接続を張る場合 true。null object は false。consumer の分岐に使う。 */
  readonly enabled: boolean;

  // --- read-model KV（cache-aside・task18） ---
  /** 未ヒット / 無効時は null（→ Mongo 直読にフォールバック）。 */
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;

  // --- Pub/Sub transport（SSE fan-out・task17） ---
  publish(channel: string, message: string): Promise<void>;
  /** channel ごとに handler を登録。subscribe 専用接続を内部で確保する（Redis の購読モード制約のため）。 */
  subscribe(channels: string[], handler: ValkeyMessageHandler): Promise<void>;

  close(): Promise<void>;
}

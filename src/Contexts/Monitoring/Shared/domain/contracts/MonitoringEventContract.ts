/**
 * MonitoringEvent のシリアライズ契約（ワイヤ形式）。
 * backend の toPrimitives 出力＝frontend が受信する JSON の単一ソース。
 * ランタイム依存ゼロ（純粋な型）。値オブジェクトはここに置かない。
 */
export type MonitoringEventPrimitives = {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredOn: string;
  readonly payload: Record<string, unknown>;
  readonly category: string;
  /** 観測時点でソース（ingest 境界）が付与する重大度。下流（AI調査/分類）で精緻化されうる。 */
  readonly severity: string;
  readonly source: string;
  /** 同一 eventName 内で症状が分かれるときの dedup 用追加識別子（任意。例: 在庫不足/競合の reason）。 */
  readonly discriminator?: string;
};

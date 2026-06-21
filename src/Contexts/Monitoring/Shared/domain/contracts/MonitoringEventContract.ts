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
  readonly source: string;
};

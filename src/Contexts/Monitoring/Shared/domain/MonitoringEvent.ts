import { AlertSeverity } from "./AlertSeverity.js";
import { MonitoringEventCategory } from "./MonitoringEventCategory.js";
import type { MonitoringEventPrimitives } from "./contracts/MonitoringEventContract.js";

// シリアライズ契約は contracts に一元化（backend/frontend 共通の単一ソース）。
export type { MonitoringEventPrimitives };

export class MonitoringEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredOn: Date;
  readonly payload: Record<string, unknown>;
  readonly category: MonitoringEventCategory;
  // 観測時点でソース（ingest 境界）が付与する重大度。category と並ぶ観測属性。
  // ソース固有イベント型 → severity の対応は変換境界（toMonitoringEvent）が知る。
  readonly severity: AlertSeverity;
  readonly source: string;

  constructor(params: {
    eventId: string;
    eventName: string;
    aggregateId: string;
    occurredOn: Date;
    payload: Record<string, unknown>;
    category: MonitoringEventCategory;
    severity: AlertSeverity;
    source: string;
  }) {
    this.eventId = params.eventId;
    this.eventName = params.eventName;
    this.aggregateId = params.aggregateId;
    this.occurredOn = params.occurredOn;
    this.payload = params.payload;
    this.category = params.category;
    this.severity = params.severity;
    this.source = params.source;
  }

  /**
   * この観測がアラート判定（分類→調査）の候補かどうか。
   * info は正常系の業務テレメトリ（例: OrderPlaced）であり、観測としては収集するが
   * アラート経路には乗せない。warning/critical のみが分類器へ進む。
   * ＝「観測の収集」と「アラート判定」を分離するトリアージ述語。
   */
  isAlertable(): boolean {
    return !this.severity.isInfo();
  }

  /**
   * 同一インシデントの重複観測をまとめるための決定的キー。
   * 検知ソースが複数（EC 自前イベント / Cloud Monitoring / CI）になった今、
   * どの単一上流もソース横断の重複を畳めない。境界での最小の冪等キーがこれ。
   *
   * 粒度は「ソース × カテゴリ × イベント種別」。aggregateId は意図的に含めない
   * ＝注文ごとに違う決済タイムアウトの嵐を1件（×N）にまとめる（storm 抑制）。
   * 異症状・同一根本原因（例: DB枯渇=infra と payment失敗=app）は別キーになる。
   * それは検知層の dedup ではなく AI 調査が根本原因として相関させる責務（境界の外）。
   */
  dedupKey(): string {
    return `${this.source}::${this.category.value}::${this.eventName}`;
  }

  toPrimitives(): MonitoringEventPrimitives {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      aggregateId: this.aggregateId,
      occurredOn: this.occurredOn.toISOString(),
      payload: this.payload,
      category: this.category.value,
      severity: this.severity.value,
      source: this.source,
    };
  }

  static fromPrimitives(primitives: MonitoringEventPrimitives): MonitoringEvent {
    return new MonitoringEvent({
      eventId: primitives.eventId,
      eventName: primitives.eventName,
      aggregateId: primitives.aggregateId,
      occurredOn: new Date(primitives.occurredOn),
      payload: primitives.payload,
      category: MonitoringEventCategory.fromString(primitives.category),
      severity: AlertSeverity.fromString(primitives.severity),
      source: primitives.source,
    });
  }
}

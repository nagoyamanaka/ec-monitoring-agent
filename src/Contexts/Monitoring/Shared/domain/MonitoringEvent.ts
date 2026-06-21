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
  readonly source: string;

  constructor(params: {
    eventId: string;
    eventName: string;
    aggregateId: string;
    occurredOn: Date;
    payload: Record<string, unknown>;
    category: MonitoringEventCategory;
    source: string;
  }) {
    this.eventId = params.eventId;
    this.eventName = params.eventName;
    this.aggregateId = params.aggregateId;
    this.occurredOn = params.occurredOn;
    this.payload = params.payload;
    this.category = params.category;
    this.source = params.source;
  }

  toPrimitives(): MonitoringEventPrimitives {
    return {
      eventId: this.eventId,
      eventName: this.eventName,
      aggregateId: this.aggregateId,
      occurredOn: this.occurredOn.toISOString(),
      payload: this.payload,
      category: this.category.value,
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
      source: primitives.source,
    });
  }
}

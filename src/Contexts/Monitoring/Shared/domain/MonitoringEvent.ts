export const MonitoringEventCategory = {
  APPLICATION: "APPLICATION",
  INFRASTRUCTURE: "INFRASTRUCTURE",
  CAPACITY: "CAPACITY",
  SECURITY: "SECURITY",
} as const;

export type MonitoringEventCategory =
  (typeof MonitoringEventCategory)[keyof typeof MonitoringEventCategory];

export type MonitoringEvent = {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredOn: Date;
  readonly payload: Record<string, unknown>;
  readonly category: MonitoringEventCategory;
  readonly source: string;
};

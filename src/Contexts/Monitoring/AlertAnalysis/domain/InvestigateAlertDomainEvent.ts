import { DomainEvent } from "../../../Shared/domain/DomainEvent.js";
import { MonitoringEventPrimitives } from "../../Shared/domain/MonitoringEvent.js";

export class InvestigateAlertDomainEvent extends DomainEvent {
  static readonly EVENT_NAME = "monitoring.alert.investigate_requested";

  readonly monitoringEvent: MonitoringEventPrimitives;

  constructor(params: {
    alertId: string;
    monitoringEvent: MonitoringEventPrimitives;
    eventId?: string;
    occurredOn?: Date;
  }) {
    super({
      eventName: InvestigateAlertDomainEvent.EVENT_NAME,
      aggregateId: params.alertId,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
    this.monitoringEvent = params.monitoringEvent;
  }

  toPrimitives(): Record<string, unknown> {
    return {
      monitoringEvent: this.monitoringEvent,
    };
  }

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): InvestigateAlertDomainEvent {
    return new InvestigateAlertDomainEvent({
      alertId: params.aggregateId,
      monitoringEvent: params.attributes.monitoringEvent as MonitoringEventPrimitives,
      eventId: params.eventId,
      occurredOn: params.occurredOn,
    });
  }
}

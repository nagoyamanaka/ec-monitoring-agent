import { DomainEventClass } from "../../../../Shared/domain/DomainEvent.js";
import { DomainEventSubscriber } from "../../../../Shared/domain/DomainEventSubscriber.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { InvestigateAlertDomainEvent } from "../../../AlertAnalysis/domain/InvestigateAlertDomainEvent.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { InvestigateAlertUseCase } from "./InvestigateAlertUseCase.js";

// AnalyzeAlert が未知アラートに対して publish する InvestigateAlertDomainEvent を
// EventBus 経由で受け取り、AI 調査ユースケースへ委譲する DomainEventSubscriber。
// 既知アラートに関してはAnalyzeAlert内で完結して、それが出来ない場合 InvestigateAlertDomainEvent
// が発行されて、このサブスクライバーが購読する。
//
// 調査は数十〜100秒かかるが、ここでは完了まで await する（完了後 ack の at-least-once を維持し、
// crash 時は redelivery で自動再調査させる）。1件の長時間調査が全キューを止める問題は、
// RabbitMQ channel の prefetch を上げて並列配信することで解消する（RabbitMqConnection.prefetchCount）。
export class InvestigateAlertOnAlertClassifiedUnknown implements DomainEventSubscriber<InvestigateAlertDomainEvent> {
  constructor(
    private readonly investigateAlertUseCase: InvestigateAlertUseCase,
  ) {}

  subscribedTo(): Array<DomainEventClass> {
    return [InvestigateAlertDomainEvent];
  }

  async on(event: InvestigateAlertDomainEvent): Promise<void> {
    await this.investigateAlertUseCase.run({
      alertId: new AlertId(event.aggregateId),
      monitoringEvent: MonitoringEvent.fromPrimitives(event.monitoringEvent),
    });
  }
}

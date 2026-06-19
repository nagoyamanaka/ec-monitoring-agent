import { DomainEvent, DomainEventClass } from "../../../../Shared/domain/DomainEvent.js";
import { DomainEventSubscriber } from "../../../../Shared/domain/DomainEventSubscriber.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { CollectMonitoringEventUseCase } from "./CollectMonitoringEventUseCase.js";

/**
 * Monitoring メタコンテキストの観測フレーム境界に立つ ingest アダプタの基底。
 * 「源固有の型 → MonitoringEvent」変換だけが源ごとの差分で、
 * 収集オーケストレーション（UseCase 委譲）は源非依存なのでここに集約する。
 * 新しい源（CI/Trivy・infra 等）は本クラスを継承するだけで追加できる（OCP）。
 */
export abstract class CollectMonitoringEventSubscriber<E extends DomainEvent>
  implements DomainEventSubscriber<E>
{
  constructor(
    protected readonly collectMonitoringEventUseCase: CollectMonitoringEventUseCase,
  ) {}

  abstract subscribedTo(): Array<DomainEventClass>;

  /** 源固有の型に触れる唯一の場所。 */
  protected abstract toMonitoringEvent(event: E): MonitoringEvent;

  async on(event: E): Promise<void> {
    await this.collectMonitoringEventUseCase.run(this.toMonitoringEvent(event));
  }
}

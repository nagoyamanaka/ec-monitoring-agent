import { DomainEvent, DomainEventClass } from "../../../../Shared/domain/DomainEvent.js";
import { DomainEventSubscriber } from "../../../../Shared/domain/DomainEventSubscriber.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { CollectMonitoringEventUseCase } from "./CollectMonitoringEventUseCase.js";

/**
 * Monitoring メタコンテキストの観測フレーム境界に立つ ingest アダプタの基底。
 * 「源固有の型 → MonitoringEvent」変換だけが源ごとの差分で、
 * 収集オーケストレーション（UseCase 委譲）は源非依存なのでここに集約する。
 *
 * ★適用範囲: 本基底は「自システム内部の RabbitMQ DomainEvent を源とする ingest」専用
 * （実装は DomainEventSubscriber=イベントバス購読）。EC 自前イベントがこれに当たる。
 * 外部からの push 源（Cloud Monitoring webhook / CI・Trivy の HTTP POST 等）は
 * 購読すべき DomainEvent を持たないため本基底は継承せず、HTTP コントローラが
 * 源固有 JSON を MonitoringEvent に正規化して CollectMonitoringEventUseCase.run() を
 * 直接呼ぶ peer なアダプタとして実装する（例: CloudMonitoringAlertIngestController /
 * SecurityScanIngestPostController）。＝「源固有→MonitoringEvent」の境界である点は同じだが、
 * 到達手段（イベントバス購読 vs HTTP）でクラス形が分かれる。
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

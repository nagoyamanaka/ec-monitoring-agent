import { EventBus } from "../../../../Shared/domain/EventBus.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { AlertClassifier } from "../../domain/classification/AlertClassifier.js";
import { InvestigateAlertDomainEvent } from "../../domain/InvestigateAlertDomainEvent.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";

export class AnalyzeAlertUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly alertClassifier: AlertClassifier,
    private readonly eventBus: EventBus,
    private readonly sseNotifier: SSEAlertNotifier,
    private readonly logger: Logger,
  ) {}

  async run(params: { alertId: AlertId; monitoringEvent: MonitoringEvent }): Promise<void> {
    const { alertId, monitoringEvent } = params;

    // 重複観測の畳み込み（classify より前）。同一 dedupKey の未解決 Alert があれば
    // 新規作成・再分類・再調査をせず発生回数だけ加算する＝アラート嵐の抑制。
    // 検知ソースが複数（EC イベント / Cloud Monitoring）になり、単一上流では
    // 横断 dedup できないため、この境界が最小の冪等点になる。
    const existing = await this.alertRepository.findOpenByDedupKey(
      monitoringEvent.dedupKey(),
    );
    if (existing) {
      const updated = existing.recordOccurrence();
      await this.alertRepository.save(updated);
      this.sseNotifier.notify(updated.toPrimitives());
      await this.logger.info({
        service: "backoffice-backend",
        action: "alert_occurrence_deduplicated",
        message: `重複観測を畳み込み：${existing.id.value}, dedupKey=${monitoringEvent.dedupKey()}, count=${updated.occurrenceCount}`,
      });
      return;
    }

    const result = await this.alertClassifier.classify(monitoringEvent);

    if (result.matched) {
      const alert = Alert.createFromKnownPattern({
        id: alertId,
        monitoringEvent,
        classification: result.classification,
      });
      await this.alertRepository.save(alert);
      this.sseNotifier.notify(alert.toPrimitives());
      // 既知一致は即・無料・決定論で確定させる＝結晶化した高速パスの価値（再発は1秒で既知分類）。
      // ここでは AI 調査を自動起動しない（InvestigateAlertDomainEvent を publish しない）。
      // 「今回の具体パラメータに合わせた調査レポート」が要るときは作業者が明示要求し
      // （POST /alerts/:id/report → InvestigateAlertUseCase が knownPatterns を grounding に生成）、
      // ホットパスに LLM のレイテンシ・コスト・非決定性を毎回載せない。
      await this.logger.info({
        service: "backoffice-backend",
        action: "alert_classified_known",
        message: `既知パターン一致：${alertId.value}, pattern=${result.classification.patternName}`,
      });
    } else {
      const alert = Alert.createAsUnknown({ id: alertId, monitoringEvent });
      await this.alertRepository.save(alert);
      this.sseNotifier.notify(alert.toPrimitives());
      await this.eventBus.publish([
        new InvestigateAlertDomainEvent({
          alertId: alertId.value,
          monitoringEvent: monitoringEvent.toPrimitives(),
        }),
      ]);
      await this.logger.warn({
        service: "backoffice-backend",
        action: "alert_classified_unknown",
        message: `未知パターン：${alertId.value}, eventName=${monitoringEvent.eventName}`,
      });
    }
  }
}

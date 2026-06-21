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
    const result = await this.alertClassifier.classify(monitoringEvent);

    if (result.matched) {
      const alert = Alert.createFromKnownPattern({
        id: alertId,
        monitoringEvent,
        classification: result.classification,
      });
      await this.alertRepository.save(alert);
      this.sseNotifier.notify(alert.toPrimitives());
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

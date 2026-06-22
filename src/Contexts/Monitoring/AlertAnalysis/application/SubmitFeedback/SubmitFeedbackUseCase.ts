import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { Uuid } from "../../../../Shared/domain/value-object/Uuid.js";
import { ResolvedIncident } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { SimilarIncidentRepository } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { KnownErrorPattern } from "../../domain/KnownErrorPattern.js";
import { KnownErrorPatternRepository } from "../../domain/KnownErrorPatternRepository.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";

// 正解フィードバックがこの回数に達したら未知パターンを自動昇格する（デモ調整用に env で上書き可能）
const DEFAULT_AUTO_PROMOTE_THRESHOLD = Number(
  process.env.FEEDBACK_AUTO_PROMOTE_THRESHOLD ?? 3,
);

export class SubmitFeedbackUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
    private readonly similarIncidentRepository: SimilarIncidentRepository,
    private readonly logger: Logger,
    private readonly autoPromoteThreshold: number = DEFAULT_AUTO_PROMOTE_THRESHOLD,
  ) {}

  async run(params: {
    alertId: AlertId;
    isCorrect: boolean;
    operatorNote?: string;
  }): Promise<void> {
    const { alertId, isCorrect, operatorNote } = params;

    const alert = await this.alertRepository.findById(alertId);
    if (alert === null) {
      throw new MonitoringResourceNotFoundError("Alert", alertId.value);
    }

    const updatedAlert = alert.submitFeedback({ isCorrect, operatorNote });
    await this.alertRepository.save(updatedAlert);

    if (isCorrect) {
      await this.indexAsResolved(updatedAlert, operatorNote);
      await this.maybeAutoPromote(updatedAlert);
    }

    await this.logger.info({
      service: "backoffice-backend",
      action: "feedback_submitted",
      message: `フィードバック受付：${alertId.value}, isCorrect=${isCorrect}`,
    });
  }

  // 正解フィードバックを解決済みインシデントとしてインデックス登録する
  private async indexAsResolved(
    alert: Alert,
    operatorNote?: string,
  ): Promise<void> {
    const incident: ResolvedIncident = {
      eventName: alert.monitoringEvent.eventName,
      occurredOn: alert.monitoringEvent.occurredOn,
      resolvedNote: operatorNote ?? "正解フィードバックによる解決",
      severity: alert.severity,
    };
    await this.similarIncidentRepository.index(incident);
  }

  // 正解フィードバックがしきい値に達した未知パターンを既知パターンへ自動昇格する
  private async maybeAutoPromote(alert: Alert): Promise<void> {
    if (alert.correctFeedbackCount < this.autoPromoteThreshold) return;
    if (alert.classification.type !== "unknown") return;
    if (alert.investigationReport === null) return;

    const report = alert.investigationReport;
    const eventName = alert.monitoringEvent.eventName;
    const pattern = KnownErrorPattern.create({
      id: Uuid.random().value,
      name: `AUTO_PROMOTED_${eventName.toUpperCase()}`,
      description: report.summary,
      eventNamePattern: eventName,
      payloadConditions: [], // 自動昇格は eventName のみでマッチ（安全側）
      severity: report.severity,
      suggestedAction: report.suggestedActions.join("\n"),
    }).promote();

    await this.knownErrorPatternRepository.save(pattern);

    await this.logger.info({
      service: "backoffice-backend",
      action: "pattern_auto_promoted",
      message: `未知パターン自動昇格：${alert.id.value}, pattern=${pattern.name}`,
    });
  }
}

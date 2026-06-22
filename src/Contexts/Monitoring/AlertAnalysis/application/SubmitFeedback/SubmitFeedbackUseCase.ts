import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { Uuid } from "../../../../Shared/domain/value-object/Uuid.js";
import { ResolvedIncident } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { SimilarIncidentRepository } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { KnownErrorPattern } from "../../domain/KnownErrorPattern.js";
import { KnownErrorPatternRepository } from "../../domain/KnownErrorPatternRepository.js";
import { FixedThresholdPromotionPolicy } from "../../domain/promotion/FixedThresholdPromotionPolicy.js";
import { PatternPromotionPolicy } from "../../domain/promotion/PatternPromotionPolicy.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";

export class SubmitFeedbackUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
    private readonly similarIncidentRepository: SimilarIncidentRepository,
    private readonly logger: Logger,
    // 昇格判定（いつ結晶化するか）は差し替え可能なドメインサービスへ委譲。既定は現挙動の固定回数。
    private readonly promotionPolicy: PatternPromotionPolicy = new FixedThresholdPromotionPolicy(),
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

  // 昇格判定（いつ）はポリシーに委譲し、満たせば既知パターンを構築・save（どう）する
  private async maybeAutoPromote(alert: Alert): Promise<void> {
    if (!this.promotionPolicy.shouldPromote(alert)) return;

    const report = alert.investigationReport;
    if (report === null) return; // ポリシーが保証済みだが型を絞るためのガード
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

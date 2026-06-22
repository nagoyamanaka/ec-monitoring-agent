import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { Filter } from "../../../../Shared/domain/criteria/Filter.js";
import { FilterField } from "../../../../Shared/domain/criteria/FilterField.js";
import { FilterOperator } from "../../../../Shared/domain/criteria/FilterOperator.js";
import { FilterValue } from "../../../../Shared/domain/criteria/FilterValue.js";
import { Filters } from "../../../../Shared/domain/criteria/Filters.js";
import { Order } from "../../../../Shared/domain/criteria/Order.js";
import { Alert } from "../../../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertRepository } from "../../../AlertAnalysis/domain/AlertRepository.js";
import { AlertSeverity } from "../../../Shared/domain/AlertSeverity.js";
import { InvestigationReport } from "../../../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../../../AlertAnalysis/domain/ReviewStatus.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";
import { SimilarIncidentRepository } from "../../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { AIInvestigationPort } from "../../domain/AIInvestigationPort.js";
import { InvestigationContext } from "../../domain/InvestigationContext.js";
import { InfraInvestigationPort } from "../../domain/InfraInvestigationPort.js";
import { InfraEvidence } from "../../domain/InfraEvidence.js";

// 類似インシデントは文脈強化用なので件数を絞る（トークン上限 3,500 を意識）
const SIMILAR_INCIDENT_LIMIT = 5;

export class InvestigateAlertUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly similarIncidentRepository: SimilarIncidentRepository,
    private readonly aiInvestigationPort: AIInvestigationPort,
    private readonly sseNotifier: SSEAlertNotifier,
    private readonly logger: Logger,
    private readonly infraInvestigationPort: InfraInvestigationPort | null = null,
  ) {}

  async run(params: {
    alertId: AlertId;
    monitoringEvent: MonitoringEvent;
  }): Promise<void> {
    const { alertId, monitoringEvent } = params;

    const alert = await this.alertRepository.findById(alertId);
    if (alert === null) return this.logSkipped(alertId);

    const context = await this.buildInvestigationContext(monitoringEvent);
    const report = await this.investigate(context, alertId);

    await this.attachAndNotify(alert, report);
    await this.logInvestigated(alertId, report);
  }

  // 類似インシデントとインフラ証拠で文脈を強化した調査コンテキストを組み立てる
  private async buildInvestigationContext(
    monitoringEvent: MonitoringEvent,
  ): Promise<InvestigationContext> {
    const [similarIncidents, infraEvidence] = await Promise.all([
      this.findSimilarIncidents(monitoringEvent),
      this.collectInfraEvidence(monitoringEvent),
    ]);

    return {
      errorEvent: {
        eventName: monitoringEvent.eventName,
        occurredOn: monitoringEvent.occurredOn.toISOString(),
        payload: monitoringEvent.payload,
        severity: monitoringEvent.severity.value,
      },
      knownPatterns: [],
      similarIncidents: similarIncidents.map((incident) => ({
        eventName: incident.eventName,
        occurredOn: incident.occurredOn.toISOString(),
        resolvedNote: incident.resolvedNote,
      })),
      ...(infraEvidence ? { infraEvidence } : {}),
    };
  }

  // インフラ証拠をベストエフォートで収集する（失敗時は undefined で調査継続）
  private async collectInfraEvidence(
    monitoringEvent: MonitoringEvent,
  ): Promise<InfraEvidence | undefined> {
    if (this.infraInvestigationPort === null) return undefined;
    try {
      return await this.infraInvestigationPort.collect(monitoringEvent);
    } catch (error) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "infra_evidence_collect_failed",
        message: `インフラ証拠収集に失敗しました（調査継続）：${(error as Error).message}`,
      });
      return undefined;
    }
  }

  // eventName 一致・最大5件で過去の類似インシデントを検索する
  private async findSimilarIncidents(monitoringEvent: MonitoringEvent) {
    return this.similarIncidentRepository.findSimilar(
      new Criteria(
        new Filters([
          new Filter(
            new FilterField("eventName"),
            FilterOperator.equal(),
            new FilterValue(monitoringEvent.eventName),
          ),
        ]),
        Order.none(),
        SIMILAR_INCIDENT_LIMIT,
      ),
    );
  }

  // AI 調査を実行する（失敗時は fallback レポートで調査を継続）
  private async investigate(
    context: InvestigationContext,
    alertId: AlertId,
  ): Promise<InvestigationReport> {
    try {
      return await this.aiInvestigationPort.investigate(context);
    } catch (error) {
      await this.logger.error({
        service: "backoffice-backend",
        action: "alert_investigate_failed",
        message: `AI調査に失敗しました：${alertId.value}, ${(error as Error).message}`,
      });
      return this.fallbackReport(context);
    }
  }

  // レポートを添付して保存し、フロントに push する
  private async attachAndNotify(
    alert: Alert,
    report: InvestigationReport,
  ): Promise<void> {
    const updatedAlert = alert.attachInvestigationReport(report);
    await this.alertRepository.save(updatedAlert);
    this.sseNotifier.notify(updatedAlert.toPrimitives());
  }

  private async logSkipped(alertId: AlertId): Promise<void> {
    await this.logger.warn({
      service: "backoffice-backend",
      action: "alert_investigate_skipped",
      message: `調査対象のAlertが見つかりません：${alertId.value}`,
    });
  }

  private async logInvestigated(
    alertId: AlertId,
    report: InvestigationReport,
  ): Promise<void> {
    await this.logger.info({
      service: "backoffice-backend",
      action: "alert_investigated",
      message: `AI調査完了：${alertId.value}, confidence=${report.confidence}`,
    });
  }

  // AI失敗時はソース付与の重大度を保持する（不正確な上書きで緊急度を歪めない）。
  private fallbackReport(context: InvestigationContext): InvestigationReport {
    return new InvestigationReport({
      summary: "AI分析に失敗しました。手動での確認をお願いします。",
      confidence: 0,
      severity: AlertSeverity.fromString(context.errorEvent.severity),
      investigationSteps: [],
      suggestedActions: ["手動で原因を確認してください"],
      suggestedPatternName: "",
      reviewStatus: ReviewStatus.pendingReview(),
      investigatedAt: new Date(),
      isFallback: true,
    });
  }
}

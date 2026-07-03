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
import { KnownErrorPatternRepository } from "../../../AlertAnalysis/domain/KnownErrorPatternRepository.js";
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
import { buildInvestigationMetrics } from "../../domain/InvestigationMetrics.js";
import { calibrateConfidence } from "../../domain/ConfidenceCalibration.js";
import { deriveForecastSubject } from "../../../Forecast/domain/forecastSubject.js";

// 類似インシデントは文脈強化用なので件数を絞る（トークン上限 3,500 を意識）
const SIMILAR_INCIDENT_LIMIT = 5;

// 相関判定の候補に渡す他アラートの上限（プロンプト水増し防御）
const CANDIDATE_ALERT_LIMIT = 20;

export class InvestigateAlertUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly similarIncidentRepository: SimilarIncidentRepository,
    private readonly aiInvestigationPort: AIInvestigationPort,
    private readonly sseNotifier: SSEAlertNotifier,
    private readonly logger: Logger,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
    private readonly infraInvestigationPort: InfraInvestigationPort | null = null,
  ) {}

  async run(params: {
    alertId: AlertId;
    monitoringEvent: MonitoringEvent;
  }): Promise<void> {
    const { alertId, monitoringEvent } = params;

    const alert = await this.alertRepository.findById(alertId);
    if (alert === null) return this.logSkipped(alertId);

    const context = await this.buildInvestigationContext(monitoringEvent, alertId);
    // 働きの明細（タスク G1）: AI 調査の実測経過時間＋読んだ証拠の件数内訳を deterministic に添付。
    // ADK / 単一 Gemini どちらの Port 実装でもここで同じ形になる（fallback レポートにも付く＝事実のみ）。
    const startedAt = Date.now();
    const investigated = await this.investigate(context, alertId);
    // 確信度キャリブレーション: LLM 自己申告を、検証可能な裏付けシグナル由来の上限で切り詰める
    // （下げるだけで上げない・fallback は対象外）。
    const calibrated = await this.applyConfidenceCalibration(
      investigated,
      context,
      alertId,
    );
    const report = this.enrichWithForecastSubject(
      calibrated,
      monitoringEvent,
      context,
    ).withMetrics(buildInvestigationMetrics(context, Date.now() - startedAt));

    await this.attachAndNotify(alert, report);
    await this.logInvestigated(alertId, report);
  }

  // 類似インシデントとインフラ証拠で文脈を強化した調査コンテキストを組み立てる
  private async buildInvestigationContext(
    monitoringEvent: MonitoringEvent,
    selfId: AlertId,
  ): Promise<InvestigationContext> {
    const [similarIncidents, infraEvidence, candidateAlerts, knownPatterns] =
      await Promise.all([
        this.findSimilarIncidents(monitoringEvent),
        this.collectInfraEvidence(monitoringEvent),
        this.collectCandidateAlerts(selfId),
        this.findMatchingKnownPatterns(monitoringEvent),
      ]);

    return {
      // 進行イベント（investigation-progress）のライブ中継に使う相関キー（プロンプトには載らない）。
      alertId: selfId.value,
      errorEvent: {
        eventName: monitoringEvent.eventName,
        occurredOn: monitoringEvent.occurredOn.toISOString(),
        payload: monitoringEvent.payload,
        severity: monitoringEvent.severity.value,
      },
      knownPatterns,
      similarIncidents: similarIncidents.map((incident) => ({
        eventName: incident.eventName,
        occurredOn: incident.occurredOn.toISOString(),
        resolvedNote: incident.resolvedNote,
      })),
      ...(infraEvidence ? { infraEvidence } : {}),
      ...(candidateAlerts.length > 0 ? { candidateAlerts } : {}),
    };
  }

  // 相関判定の候補＝自分以外の他アラートをベストエフォートで収集する（失敗時は空配列）。
  // AI はこの候補の中からのみ relatedAlerts を選ぶ（存在しない alertId を作らせない）。
  private async collectCandidateAlerts(
    selfId: AlertId,
  ): Promise<NonNullable<InvestigationContext["candidateAlerts"]>> {
    try {
      const alerts = await this.alertRepository.findByCriteria(
        new Criteria(new Filters([]), Order.none(), CANDIDATE_ALERT_LIMIT),
      );
      return alerts
        .filter((alert) => alert.id.value !== selfId.value)
        .map((alert) => {
          const primitives = alert.toPrimitives();
          return {
            alertId: primitives.id,
            eventName: primitives.monitoringEvent.eventName,
            category: primitives.monitoringEvent.category,
            occurredOn: primitives.monitoringEvent.occurredOn,
            summary: primitives.investigationReport?.summary ?? "",
          };
        });
    } catch (error) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "candidate_alerts_collect_failed",
        message: `相関候補アラートの収集に失敗しました（調査継続）：${(error as Error).message}`,
      });
      return [];
    }
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

  // このイベントに関連する既知パターンを AI 調査の grounding 文脈として収集する。
  // 既知一致した Alert では該当パターンが必ず含まれ、AI は「今回の具体パラメータ」に
  // 合わせた報告を、過去の学習（パターンの description）を踏まえて書く。
  // ベストエフォート（失敗時は空配列で調査継続）。
  private async findMatchingKnownPatterns(
    monitoringEvent: MonitoringEvent,
  ): Promise<InvestigationContext["knownPatterns"]> {
    try {
      const patterns = await this.knownErrorPatternRepository.findAll();
      return patterns
        .filter((p) => p.eventNamePattern === monitoringEvent.eventName)
        .map((p) => ({
          name: p.name,
          description: p.description,
          eventNamePattern: p.eventNamePattern,
        }));
    } catch (error) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "known_patterns_collect_failed",
        message: `既知パターン文脈の収集に失敗しました（調査継続）：${(error as Error).message}`,
      });
      return [];
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

  // 確信度キャリブレーションを適用する。根拠（シグナル・上限・自己申告）は常に報告書へ記録し、
  // 切り詰めが起きた場合は説明ログも残す（透明性）。fallback は confidence=0 の定型なので対象外。
  private async applyConfidenceCalibration(
    report: InvestigationReport,
    context: InvestigationContext,
    alertId: AlertId,
  ): Promise<InvestigationReport> {
    if (report.isFallback) return report;

    const calibration = calibrateConfidence(report, context);
    if (calibration.calibrated < calibration.original) {
      await this.logger.info({
        service: "backoffice-backend",
        action: "confidence_calibrated",
        message:
          `確信度を証拠裏付けで補正：${alertId.value}, ` +
          `${calibration.original}→${calibration.calibrated}` +
          `（上限${calibration.cap}・根拠: ${calibration.signals.join(",") || "なし"}）`,
      });
    }
    return report.withConfidenceCalibration(calibration);
  }

  // Forecast 突合キー（F2）: 調査時点の文脈から subject を導出して埋める。
  // fallback レポートも category から導出できるので一律に通す（既に持つ場合は保持）。
  private enrichWithForecastSubject(
    report: InvestigationReport,
    monitoringEvent: MonitoringEvent,
    context: InvestigationContext,
  ): InvestigationReport {
    if (report.subject) return report;
    return report.withSubject(
      deriveForecastSubject({
        suggestedPatternName: report.suggestedPatternName,
        category: monitoringEvent.category.value,
        terraformResources: context.infraEvidence?.terraformDiff?.changedResources,
      }),
    );
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

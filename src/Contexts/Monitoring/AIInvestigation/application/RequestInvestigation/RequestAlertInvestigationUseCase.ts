import { EventBus } from "../../../../Shared/domain/EventBus.js";
import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertRepository } from "../../../AlertAnalysis/domain/AlertRepository.js";
import { InvestigateAlertDomainEvent } from "../../../AlertAnalysis/domain/InvestigateAlertDomainEvent.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";

/**
 * オンデマンド AI 調査（POST /alerts/:id/report）。
 *
 * 既知一致 Alert は即・無料・決定論で確定させる（AnalyzeAlert は既知で AI を自動起動しない）。
 * 「今回の具体パラメータに合わせた調査レポートが欲しい」ときだけ作業者が明示要求し、この UseCase が
 * 既存の非同期調査ループ（`InvestigateAlertDomainEvent` → `InvestigateAlertOnAlertClassifiedUnknown`
 * → `InvestigateAlertUseCase`）を再利用して起動する。InvestigateAlertUseCase は該当 Alert の
 * eventName に一致する既知パターンを grounding 文脈に載せるので、過去の学習を踏まえた報告になる。
 * 結果（レポート添付）は SSE で push されるため、コントローラは 202 を返す（CQRS 分離）。
 */
export class RequestAlertInvestigationUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly eventBus: EventBus,
    private readonly sseNotifier: SSEAlertNotifier,
    private readonly logger: Logger,
  ) {}

  async run(params: { alertId: AlertId }): Promise<void> {
    const { alertId } = params;

    const alert = await this.alertRepository.findById(alertId);
    if (alert === null) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "alert_report_request_skipped",
        message: `レポート要求対象の Alert が見つかりません：${alertId.value}`,
      });
      return;
    }

    // 調査開始を即時に可視化する（ANALYZING へ遷移して push）。既知一致は自動起動しないため、
    // これが無いと「ボタンを押したのに無反応（調査完了まで数十秒）」に見える。分類・レビューは保持。
    const analyzing = alert.beginInvestigation();
    await this.alertRepository.save(analyzing);
    this.sseNotifier.notify(analyzing.toPrimitives());

    await this.eventBus.publish([
      new InvestigateAlertDomainEvent({
        alertId: alertId.value,
        monitoringEvent: alert.monitoringEvent.toPrimitives(),
      }),
    ]);

    await this.logger.info({
      service: "backoffice-backend",
      action: "alert_report_requested",
      message: `オンデマンド調査を起動：${alertId.value}, eventName=${alert.monitoringEvent.eventName}`,
    });
  }
}

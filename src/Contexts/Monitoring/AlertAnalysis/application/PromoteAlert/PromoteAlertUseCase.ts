import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { KnownErrorPatternRepository } from "../../domain/KnownErrorPatternRepository.js";
import { crystallizePatternFromAlert } from "../../domain/promotion/crystallizePatternFromAlert.js";
import { AlertNotPromotableError } from "../errors/AlertNotPromotableError.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";

/**
 * 手動即時昇格（POST /alerts/:id/promote）。
 *
 * フィードバック回数の閾値到達を待つ自動昇格（`SubmitFeedbackUseCase.maybeAutoPromote`）と違い、
 * オペレーターの明示操作で「今この Alert を既知パターンへ結晶化する」1クリック操作。
 * デモで「未知→調査→昇格→次回は1秒で既知」を回数を稼がずに見せるための入口。
 * 結晶化ロジック自体は `crystallizePatternFromAlert` に集約（自動昇格と同一・接頭辞のみ差異）。
 */
export class PromoteAlertUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
    private readonly logger: Logger,
  ) {}

  async run(params: { alertId: AlertId }): Promise<void> {
    const { alertId } = params;

    const alert = await this.alertRepository.findById(alertId);
    if (alert === null) {
      throw new MonitoringResourceNotFoundError("Alert", alertId.value);
    }

    const pattern = crystallizePatternFromAlert(alert, "PROMOTED");
    if (pattern === null) {
      throw new AlertNotPromotableError(alertId.value);
    }

    await this.knownErrorPatternRepository.save(pattern);

    await this.logger.info({
      service: "backoffice-backend",
      action: "alert_promoted_manually",
      message: `手動即時昇格：${alertId.value}, pattern=${pattern.name}`,
    });
  }
}

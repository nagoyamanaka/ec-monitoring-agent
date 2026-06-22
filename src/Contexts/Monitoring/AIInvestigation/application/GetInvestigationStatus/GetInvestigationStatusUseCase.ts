import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertRepository } from "../../../AlertAnalysis/domain/AlertRepository.js";
import { MonitoringResourceNotFoundError } from "../../../AlertAnalysis/application/errors/MonitoringResourceNotFoundError.js";
import { InvestigationStatusResponse } from "./InvestigationStatusResponse.js";

// アラートの調査ステータス（collecting/analyzing/done）を返す。状態は Alert から導出する。
export class GetInvestigationStatusUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly logger: Logger,
  ) {}

  async run(id: AlertId): Promise<InvestigationStatusResponse> {
    const alert = await this.alertRepository.findById(id);

    if (!alert) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "get_investigation_status_not_found",
        message: `アラート未存在：${id.value}`,
      });
      throw new MonitoringResourceNotFoundError("Alert", id.value);
    }

    return new InvestigationStatusResponse(alert);
  }
}

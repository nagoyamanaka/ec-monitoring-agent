import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";
import { AlertResponse } from "../AlertResponse.js";

export class GetAlertUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly logger: Logger,
  ) {}

  async run(id: AlertId): Promise<AlertResponse> {
    const alert = await this.alertRepository.findById(id);

    if (!alert) {
      await this.logger.warn({
        service: "backoffice-backend",
        action: "get_alert_not_found",
        message: `アラート未存在：${id.value}`,
      });
      throw new MonitoringResourceNotFoundError("Alert", id.value);
    }

    return new AlertResponse([alert]);
  }
}

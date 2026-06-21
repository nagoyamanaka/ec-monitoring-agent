import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { AlertResponse } from "../AlertResponse.js";

export class GetAlertReportUseCase {
  constructor(private readonly alertRepository: AlertRepository) {}

  async run(): Promise<AlertResponse> {
    const alerts = await this.alertRepository.findByCriteria(Criteria.none());
    return new AlertResponse(alerts);
  }
}

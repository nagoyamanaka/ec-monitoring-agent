import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { AnalyticsResponse } from "./AnalyticsResponse.js";

export class GetAnalyticsUseCase {
  constructor(private readonly alertRepository: AlertRepository) {}

  async run(): Promise<AnalyticsResponse> {
    const alerts = await this.alertRepository.findByCriteria(Criteria.none());
    return new AnalyticsResponse(alerts);
  }
}

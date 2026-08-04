import { Response } from "../../../../Shared/domain/Response.js";
import { RiskForecastRepository } from "../../domain/ForecastBriefing.js";
import { buildForecastMeasurement, ForecastMeasurement } from "./ForecastMeasurement.js";

export class ForecastMeasurementResponse implements Response {
  constructor(public readonly measurement: ForecastMeasurement) {}
}

/**
 * 予報の測定値を履歴から数え直す（read-only）。
 * 保存時に集計を持ち回らず毎回数え直すのは、母数が2桁で安いことに加えて、
 * **数え方を変えたときに過去の標本へも遡って効く**ほうが測定として正しいため。
 */
export class GetForecastMeasurementUseCase {
  constructor(private readonly riskForecastRepository: RiskForecastRepository) {}

  async run(): Promise<ForecastMeasurementResponse> {
    const briefings = await this.riskForecastRepository.findAll();
    return new ForecastMeasurementResponse(buildForecastMeasurement(briefings));
  }
}

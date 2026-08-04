import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { GetForecastMeasurementQuery } from "./GetForecastMeasurementQuery.js";
import {
  ForecastMeasurementResponse,
  GetForecastMeasurementUseCase,
} from "./GetForecastMeasurementUseCase.js";

export class GetForecastMeasurementQueryHandler
  implements QueryHandler<GetForecastMeasurementQuery, ForecastMeasurementResponse>
{
  constructor(private readonly useCase: GetForecastMeasurementUseCase) {}

  subscribedTo() {
    return GetForecastMeasurementQuery;
  }

  async handle(_query: GetForecastMeasurementQuery): Promise<ForecastMeasurementResponse> {
    return this.useCase.run();
  }
}

import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { AnalyticsResponse } from "./AnalyticsResponse.js";
import { GetAnalyticsQuery } from "./GetAnalyticsQuery.js";
import { GetAnalyticsUseCase } from "./GetAnalyticsUseCase.js";

export class GetAnalyticsQueryHandler
  implements QueryHandler<GetAnalyticsQuery, AnalyticsResponse>
{
  constructor(private readonly useCase: GetAnalyticsUseCase) {}

  subscribedTo() {
    return GetAnalyticsQuery;
  }

  async handle(_query: GetAnalyticsQuery): Promise<AnalyticsResponse> {
    return this.useCase.run();
  }
}

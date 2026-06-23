import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { GetInvestigationStatusQuery } from "./GetInvestigationStatusQuery.js";
import { GetInvestigationStatusUseCase } from "./GetInvestigationStatusUseCase.js";
import { InvestigationStatusResponse } from "./InvestigationStatusResponse.js";

export class GetInvestigationStatusQueryHandler
  implements
    QueryHandler<GetInvestigationStatusQuery, InvestigationStatusResponse>
{
  constructor(private readonly useCase: GetInvestigationStatusUseCase) {}

  subscribedTo() {
    return GetInvestigationStatusQuery;
  }

  async handle(
    query: GetInvestigationStatusQuery,
  ): Promise<InvestigationStatusResponse> {
    return this.useCase.run(new AlertId(query.alertId));
  }
}

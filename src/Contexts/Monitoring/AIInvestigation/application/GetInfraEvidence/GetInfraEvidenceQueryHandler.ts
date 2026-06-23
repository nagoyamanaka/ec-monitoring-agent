import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { InfraEvidenceResponse } from "./InfraEvidenceResponse.js";
import { GetInfraEvidenceQuery } from "./GetInfraEvidenceQuery.js";
import { GetInfraEvidenceUseCase } from "./GetInfraEvidenceUseCase.js";

export class GetInfraEvidenceQueryHandler
  implements QueryHandler<GetInfraEvidenceQuery, InfraEvidenceResponse>
{
  constructor(private readonly useCase: GetInfraEvidenceUseCase) {}

  subscribedTo() {
    return GetInfraEvidenceQuery;
  }

  async handle(query: GetInfraEvidenceQuery): Promise<InfraEvidenceResponse> {
    return this.useCase.run(new AlertId(query.alertId));
  }
}

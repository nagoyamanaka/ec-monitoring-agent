import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { GetRemediationQuery } from "./GetRemediationQuery.js";
import { GetRemediationUseCase } from "./GetRemediationUseCase.js";
import { RemediationResponse } from "./RemediationResponse.js";

export class GetRemediationQueryHandler
  implements QueryHandler<GetRemediationQuery, RemediationResponse>
{
  constructor(private readonly useCase: GetRemediationUseCase) {}

  subscribedTo() {
    return GetRemediationQuery;
  }

  async handle(query: GetRemediationQuery): Promise<RemediationResponse> {
    return this.useCase.run(query.alertId);
  }
}

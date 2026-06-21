import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { PatternResponse } from "./PatternResponse.js";
import { GetKnownErrorPatternsQuery } from "./GetKnownErrorPatternsQuery.js";
import { GetKnownErrorPatternsUseCase } from "./GetKnownErrorPatternsUseCase.js";

export class GetKnownErrorPatternsQueryHandler
  implements QueryHandler<GetKnownErrorPatternsQuery, PatternResponse>
{
  constructor(private readonly useCase: GetKnownErrorPatternsUseCase) {}

  subscribedTo() {
    return GetKnownErrorPatternsQuery;
  }

  async handle(_query: GetKnownErrorPatternsQuery): Promise<PatternResponse> {
    return this.useCase.run();
  }
}

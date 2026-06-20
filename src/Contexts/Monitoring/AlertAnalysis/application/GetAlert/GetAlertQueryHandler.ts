import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertResponse } from "../AlertResponse.js";
import { GetAlertQuery } from "./GetAlertQuery.js";
import { GetAlertUseCase } from "./GetAlertUseCase.js";

export class GetAlertQueryHandler
  implements QueryHandler<GetAlertQuery, AlertResponse>
{
  constructor(private readonly useCase: GetAlertUseCase) {}

  subscribedTo() {
    return GetAlertQuery;
  }

  async handle(query: GetAlertQuery): Promise<AlertResponse> {
    return this.useCase.run(new AlertId(query.alertId));
  }
}

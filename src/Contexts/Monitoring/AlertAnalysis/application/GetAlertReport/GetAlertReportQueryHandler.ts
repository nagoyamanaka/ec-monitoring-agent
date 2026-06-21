import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { AlertResponse } from "../AlertResponse.js";
import { GetAlertReportQuery } from "./GetAlertReportQuery.js";
import { GetAlertReportUseCase } from "./GetAlertReportUseCase.js";

export class GetAlertReportQueryHandler
  implements QueryHandler<GetAlertReportQuery, AlertResponse>
{
  constructor(private readonly useCase: GetAlertReportUseCase) {}

  subscribedTo() {
    return GetAlertReportQuery;
  }

  async handle(_query: GetAlertReportQuery): Promise<AlertResponse> {
    return this.useCase.run();
  }
}

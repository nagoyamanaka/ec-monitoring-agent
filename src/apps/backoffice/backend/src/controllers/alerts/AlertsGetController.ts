import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetAlertReportQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetAlertReport/GetAlertReportQuery.js";

export class AlertsGetController {
  constructor(private readonly queryBus: QueryBus) {}

  async run(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.queryBus.ask(new GetAlertReportQuery());
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

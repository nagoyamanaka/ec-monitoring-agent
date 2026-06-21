import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetAlertQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetAlert/GetAlertQuery.js";
import { AlertResponse } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/AlertResponse.js";

export class AlertGetController {
  constructor(private readonly queryBus: QueryBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.queryBus.ask<AlertResponse>(new GetAlertQuery(req.params.id));
      res.json(response.alerts[0]);
    } catch (error) {
      next(error);
    }
  }
}

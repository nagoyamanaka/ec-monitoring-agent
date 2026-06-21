import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetKnownErrorPatternsQuery } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/GetKnownErrorPatterns/GetKnownErrorPatternsQuery.js";

export class PatternsGetController {
  constructor(private readonly queryBus: QueryBus) {}

  async run(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.queryBus.ask(new GetKnownErrorPatternsQuery());
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

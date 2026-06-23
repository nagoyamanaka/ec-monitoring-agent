import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetRemediationQuery } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/GetRemediation/GetRemediationQuery.js";
import { RemediationResponse } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/GetRemediation/RemediationResponse.js";

// GET /alerts/:id/remediation
export class RemediationGetController {
  constructor(private readonly queryBus: QueryBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.queryBus.ask<RemediationResponse>(
        new GetRemediationQuery(req.params.id),
      );
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

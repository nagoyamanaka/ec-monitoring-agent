import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetInfraEvidenceQuery } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/GetInfraEvidence/GetInfraEvidenceQuery.js";
import { InfraEvidenceResponse } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/GetInfraEvidence/InfraEvidenceResponse.js";
import { GetInvestigationStatusQuery } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/GetInvestigationStatus/GetInvestigationStatusQuery.js";
import { InvestigationStatusResponse } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/GetInvestigationStatus/InvestigationStatusResponse.js";

export class AlertEvidenceGetController {
  constructor(private readonly queryBus: QueryBus) {}

  // GET /alerts/:id/evidence
  async evidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.queryBus.ask<InfraEvidenceResponse>(
        new GetInfraEvidenceQuery(req.params.id),
      );
      res.json(response.evidence);
    } catch (error) {
      next(error);
    }
  }

  // GET /alerts/:id/investigation/status
  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.queryBus.ask<InvestigationStatusResponse>(
        new GetInvestigationStatusQuery(req.params.id),
      );
      res.json({ alertId: response.alertId, status: response.status });
    } catch (error) {
      next(error);
    }
  }
}

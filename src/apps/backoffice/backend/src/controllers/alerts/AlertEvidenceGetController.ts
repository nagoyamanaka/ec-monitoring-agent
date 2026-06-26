import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetInfraEvidenceQuery } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/GetInfraEvidence/GetInfraEvidenceQuery.js";
import { InfraEvidenceResponse } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/GetInfraEvidence/InfraEvidenceResponse.js";

export class AlertEvidenceGetController {
  constructor(private readonly queryBus: QueryBus) {}

  // GET /alerts/:id/evidence
  // 調査の進捗（done/analyzing）は SSE で push される alert.status からフロントが導出するため、
  // 専用の investigation/status エンドポイントは持たない（同じ事実を二重に持たない）。
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
}

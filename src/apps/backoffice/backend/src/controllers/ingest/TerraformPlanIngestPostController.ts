import { NextFunction, Request, Response } from "express";
import {
  InvalidTerraformPlanError,
  TerraformPlanIngestBody,
  TerraformPlanTranslator,
} from "../../../../../../Contexts/Monitoring/AIInvestigation/application/RecordPendingPlan/TerraformPlanTranslator.js";
import { PendingInfraPlanStore } from "../../../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/PendingInfraPlanStore.js";

/**
 * POST /ingest/terraform-plan
 * GitHub Actions（terraform.yml の plan ジョブ）が PR の未適用 plan を積む検知ソース境界。
 * デモ seed（ForecastPendingPlanSeed）と同じ record 口に到達し、予兆の
 * PendingPlanSignalSource が FUTURE_CHANGE シグナル（url 付き＝証拠を開く可）として拾う。
 * 正規化は TerraformPlanTranslator に委ね、コントローラは認証・パース・HTTP 応答だけの薄い境界。
 * SecurityScanIngest と同じ x-ingest-token で保護する。
 */
export class TerraformPlanIngestPostController {
  constructor(
    private readonly pendingInfraPlanStore: PendingInfraPlanStore,
    private readonly ingestToken: string,
  ) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (this.ingestToken && req.header("x-ingest-token") !== this.ingestToken) {
        res.status(401).json({ error: "invalid ingest token" });
        return;
      }

      let plan;
      try {
        plan = TerraformPlanTranslator.toPendingPlan(req.body as TerraformPlanIngestBody);
      } catch (error) {
        if (error instanceof InvalidTerraformPlanError) {
          res.status(400).json({ error: error.message });
          return;
        }
        throw error;
      }

      await this.pendingInfraPlanStore.record(plan);
      res.status(202).json({ accepted: true, resourceCount: plan.resourceChanges.length });
    } catch (error) {
      next(error);
    }
  }
}

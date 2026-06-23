import { NextFunction, Request, Response } from "express";
import { RecordRemediationResultUseCase } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/RecordRemediationResult/RecordRemediationResultUseCase.js";

type RemediationResultBody = {
  alertId?: string;
  status?: string; // "drafted" | "failed"
  pullRequestUrl?: string | null;
  reason?: string | null;
};

const ACCEPTED_STATUSES = new Set(["drafted", "failed"]);

/**
 * POST /ingest/remediation-result
 * GitHub Actions のAIリメディジョブが完了時に呼ぶ callback。
 * dispatched で受け付けた修正の最終結果（PR起票成功 or 失敗）を確定する。
 * SecurityScanIngest と同じ x-ingest-token で保護する。
 */
export class RemediationResultIngestPostController {
  constructor(
    private readonly recordRemediationResultUseCase: RecordRemediationResultUseCase,
    private readonly ingestToken: string,
  ) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (this.ingestToken && req.header("x-ingest-token") !== this.ingestToken) {
        res.status(401).json({ error: "invalid ingest token" });
        return;
      }

      const body = req.body as RemediationResultBody;
      const status = (body.status ?? "").toLowerCase();
      if (!body.alertId || !ACCEPTED_STATUSES.has(status)) {
        res.status(400).json({ error: "alertId and status(drafted|failed) are required" });
        return;
      }

      await this.recordRemediationResultUseCase.run({
        alertId: body.alertId,
        status: status as "drafted" | "failed",
        pullRequestUrl: body.pullRequestUrl ?? null,
        reason: body.reason ?? null,
      });
      res.status(202).json({ accepted: true });
    } catch (error) {
      next(error);
    }
  }
}

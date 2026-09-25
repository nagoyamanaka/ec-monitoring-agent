import { NextFunction, Request, Response } from "express";
import { RebuildSimilarIncidentsUseCase } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/RebuildSimilarIncidents/RebuildSimilarIncidentsUseCase.js";

/**
 * POST /admin/similar-incidents/rebuild
 * 類似コーパス（ES）を正本（Mongo の承認済み Alert）から作り直す管理コマンド。
 * ES のデータが飛んだとき・マッピング変更で reindex が要るときに運用者が1回打つ（常駐しない）。
 * 認証は ingest 境界と同じ x-ingest-token（運用者が持つ唯一の入口側共有秘密。管理専用トークンを増やさない）。
 */
export class SimilarIncidentsRebuildPostController {
  constructor(
    private readonly useCase: RebuildSimilarIncidentsUseCase,
    private readonly ingestToken: string,
  ) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (this.ingestToken && req.header("x-ingest-token") !== this.ingestToken) {
        res.status(401).json({ error: "invalid ingest token" });
        return;
      }
      const result = await this.useCase.run();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { DraftRemediationCommand } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/DraftRemediation/DraftRemediationCommand.js";

// POST /alerts/:id/remediation/draft-pr
// 起票は同期処理だが結果（PR URL）は GET /remediation で読む CQRS 分離。202 を返す。
export class RemediationDraftPrPostController {
  constructor(private readonly commandBus: CommandBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.commandBus.dispatch(new DraftRemediationCommand(req.params.id));
      res.status(202).json({ accepted: true });
    } catch (error) {
      next(error);
    }
  }
}

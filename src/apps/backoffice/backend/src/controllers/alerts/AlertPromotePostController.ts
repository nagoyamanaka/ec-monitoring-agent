import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { PromoteAlertCommand } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/PromoteAlert/PromoteAlertCommand.js";

// POST /alerts/:id/promote
// 手動即時昇格。この Alert（＋AI調査レポート）を回数不問で既知パターンへ結晶化する。
// 以後の同型障害は完全一致の高速パスで即・無料・決定論に「既知」分類される。
export class AlertPromotePostController {
  constructor(private readonly commandBus: CommandBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.commandBus.dispatch(new PromoteAlertCommand(req.params.id));
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}

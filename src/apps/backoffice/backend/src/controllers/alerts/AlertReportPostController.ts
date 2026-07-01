import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { RequestAlertInvestigationCommand } from "../../../../../../Contexts/Monitoring/AIInvestigation/application/RequestInvestigation/RequestAlertInvestigationCommand.js";

// POST /alerts/:id/report
// 既知一致 Alert（AI 自動調査なしで即確定）に対し、作業者の明示要求でオンデマンド AI 調査をキックする。
// 調査は非同期に進み、結果（レポート添付）は SSE で push されるため 202 を返す（CQRS 分離）。
export class AlertReportPostController {
  constructor(private readonly commandBus: CommandBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.commandBus.dispatch(
        new RequestAlertInvestigationCommand(req.params.id),
      );
      res.status(202).json({ accepted: true });
    } catch (error) {
      next(error);
    }
  }
}

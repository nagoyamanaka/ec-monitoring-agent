import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { SubmitFeedbackCommand } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/SubmitFeedback/SubmitFeedbackCommand.js";

export class AlertFeedbackPatchController {
  constructor(private readonly commandBus: CommandBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isCorrect, operatorNote } = req.body as {
        isCorrect: boolean;
        operatorNote?: string;
      };
      await this.commandBus.dispatch(
        new SubmitFeedbackCommand(req.params.id, isCorrect, operatorNote),
      );
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}

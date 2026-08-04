import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { SubmitFeedbackCommand } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/SubmitFeedback/SubmitFeedbackCommand.js";
import type { ReviewDecision } from "../../../../../../Contexts/Monitoring/AlertAnalysis/domain/Alert.js";

const REVIEW_DECISIONS = ["acted", "deferred", "rejected"] as const;

// 決裁は「人間が選んだ」ことに意味があるので、想定外の値は受け取らず未指定に畳む
// （isCorrect からの導出＝derived として記録される）。捏造された決裁を台帳に入れない。
function toReviewDecision(value: unknown): ReviewDecision | undefined {
  return REVIEW_DECISIONS.includes(value as ReviewDecision)
    ? (value as ReviewDecision)
    : undefined;
}

export class AlertFeedbackPatchController {
  constructor(private readonly commandBus: CommandBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isCorrect, operatorNote, decision } = req.body as {
        isCorrect: boolean;
        operatorNote?: string;
        decision?: unknown;
      };
      await this.commandBus.dispatch(
        new SubmitFeedbackCommand(
          req.params.id,
          isCorrect,
          operatorNote,
          toReviewDecision(decision),
        ),
      );
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}

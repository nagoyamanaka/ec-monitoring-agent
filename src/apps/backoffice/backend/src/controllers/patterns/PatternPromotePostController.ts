import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { PromotePatternCommand } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/PromotePattern/PromotePatternCommand.js";

export class PatternPromotePostController {
  constructor(private readonly commandBus: CommandBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.commandBus.dispatch(new PromotePatternCommand(req.params.id));
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}

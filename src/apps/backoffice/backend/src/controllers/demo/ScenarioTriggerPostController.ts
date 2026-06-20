import { NextFunction, Request, Response } from "express";
import {
  TriggerDemoScenarioUseCase,
  UnsupportedScenarioError,
} from "../../demo/TriggerDemoScenarioUseCase.js";

export class ScenarioTriggerPostController {
  constructor(private readonly useCase: TriggerDemoScenarioUseCase) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.useCase.run(req.params.id);
      res.status(202).json(result);
    } catch (error) {
      if (error instanceof UnsupportedScenarioError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
}

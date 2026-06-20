import { NextFunction, Request, Response } from "express";
import { DemoResetUseCase } from "../../demo/DemoResetUseCase.js";

export class DemoResetPostController {
  constructor(private readonly useCase: DemoResetUseCase) {}

  async run(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.useCase.run();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

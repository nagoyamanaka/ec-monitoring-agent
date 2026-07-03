import { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

// FORECAST_ENABLED が false（既定）では forecast ルートの存在自体を隠す（404・demoGuard と同方針）。
export function forecastGuard(_req: Request, res: Response, next: NextFunction): void {
  if (!config.forecast.enabled) {
    res.sendStatus(404);
    return;
  }
  next();
}

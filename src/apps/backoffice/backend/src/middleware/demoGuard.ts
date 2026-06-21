import { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

// DEMO_ENABLED が false の本番では demo ルートの存在自体を隠す（404）。
export function demoGuard(_req: Request, res: Response, next: NextFunction): void {
  if (!config.demo.enabled) {
    res.sendStatus(404);
    return;
  }
  next();
}

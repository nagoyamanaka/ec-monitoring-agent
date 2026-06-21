import { NextFunction, Request, Response } from "express";
import { EcDemoGateway, PaymentMode } from "../../demo/EcDemoGateway.js";

// EC backend の /demo/payment-mode へ中継する proxy コントローラ。
export class PaymentModePostController {
  constructor(private readonly ecDemoGateway: EcDemoGateway) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mode } = req.body as { mode: PaymentMode };
      await this.ecDemoGateway.setPaymentMode(mode);
      res.json({ mode });
    } catch (error) {
      next(error);
    }
  }
}

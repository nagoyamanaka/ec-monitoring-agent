import { Request, Response } from "express";
import { PaymentMockGateway, PaymentMode } from "../../../../../../Contexts/EC/Payment/infrastructure/PaymentMockGateway.js";

export class PaymentModePostController {
  constructor(private readonly paymentGateway: PaymentMockGateway) {}

  run(req: Request, res: Response): void {
    const { mode } = req.body as { mode: PaymentMode };
    this.paymentGateway.setMode(mode);
    res.json({ mode });
  }
}

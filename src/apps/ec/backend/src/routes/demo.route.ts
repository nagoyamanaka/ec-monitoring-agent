import { Router } from "express";
import { PaymentMockOrderGateway } from "../../../../../Contexts/EC/Orders/infrastructure/PaymentMockOrderGateway.js";
import { PaymentModePostController } from "../controllers/demo/PaymentModePostController.js";

export function registerDemoRoutes(router: Router, paymentGateway: PaymentMockOrderGateway): void {
  const controller = new PaymentModePostController(paymentGateway);
  router.post("/demo/payment-mode", controller.run.bind(controller));
}

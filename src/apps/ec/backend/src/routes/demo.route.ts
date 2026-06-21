import { Router } from "express";
import { PaymentMockOrderGateway } from "../../../../../Contexts/EC/Orders/infrastructure/PaymentMockOrderGateway.js";
import { DemoInventoryRepository } from "../../../../../Contexts/EC/Inventory/infrastructure/DemoInventoryRepository.js";
import { PaymentModePostController } from "../controllers/demo/PaymentModePostController.js";
import { InventoryModePostController } from "../controllers/demo/InventoryModePostController.js";

export function registerDemoRoutes(
  router: Router,
  paymentGateway: PaymentMockOrderGateway,
  demoInventoryRepository: DemoInventoryRepository,
): void {
  const paymentModeController = new PaymentModePostController(paymentGateway);
  const inventoryModeController = new InventoryModePostController(demoInventoryRepository);
  router.post("/demo/payment-mode", paymentModeController.run.bind(paymentModeController));
  router.post("/demo/inventory-mode", inventoryModeController.run.bind(inventoryModeController));
}

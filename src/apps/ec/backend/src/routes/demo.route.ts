import { Router } from "express";
import { PaymentMockOrderGateway } from "../../../../../Contexts/EC/Orders/infrastructure/PaymentMockOrderGateway.js";
import { DemoInventoryRepository } from "../../../../../Contexts/EC/Inventory/infrastructure/DemoInventoryRepository.js";
import { Logger } from "../../../../../Contexts/Shared/domain/logging/Logger.js";
import { PaymentModePostController } from "../controllers/demo/PaymentModePostController.js";
import { InventoryModePostController } from "../controllers/demo/InventoryModePostController.js";
import { InfraFaultPostController } from "../controllers/demo/InfraFaultPostController.js";

export function registerDemoRoutes(
  router: Router,
  paymentGateway: PaymentMockOrderGateway,
  demoInventoryRepository: DemoInventoryRepository,
  logger: Logger,
): void {
  const paymentModeController = new PaymentModePostController(paymentGateway);
  const inventoryModeController = new InventoryModePostController(demoInventoryRepository);
  const infraFaultController = new InfraFaultPostController(logger);
  router.post("/demo/payment-mode", paymentModeController.run.bind(paymentModeController));
  router.post("/demo/inventory-mode", inventoryModeController.run.bind(inventoryModeController));
  router.post("/demo/infra-fault", infraFaultController.run.bind(infraFaultController));
}

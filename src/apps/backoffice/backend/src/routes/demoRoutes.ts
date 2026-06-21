import { Router } from "express";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { demoGuard } from "../middleware/demoGuard.js";
import { DemoDependencies } from "../demo/DemoDependencies.js";
import { PaymentModePostController } from "../controllers/demo/PaymentModePostController.js";
import { ScenarioTriggerPostController } from "../controllers/demo/ScenarioTriggerPostController.js";
import { DemoResetPostController } from "../controllers/demo/DemoResetPostController.js";
import { DemoStatusGetController } from "../controllers/demo/DemoStatusGetController.js";

export function registerDemoRoutes(
  router: Router,
  queryBus: QueryBus,
  deps: DemoDependencies,
): void {
  // DEMO_ENABLED=false の本番では /demo/* をまとめて 404 にする
  router.use("/demo", demoGuard);

  const paymentModeController = new PaymentModePostController(deps.ecDemoGateway);
  const scenarioController = new ScenarioTriggerPostController(deps.triggerScenarioUseCase);
  const resetController = new DemoResetPostController(deps.demoResetUseCase);
  const statusController = new DemoStatusGetController(queryBus);

  router.post("/demo/payment-mode", paymentModeController.run.bind(paymentModeController));
  router.post("/demo/scenario/:id/trigger", scenarioController.run.bind(scenarioController));
  router.post("/demo/reset", resetController.run.bind(resetController));
  router.get("/demo/status", statusController.run.bind(statusController));
}

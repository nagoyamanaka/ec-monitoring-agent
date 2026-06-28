import { Router } from "express";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { demoGuard } from "../middleware/demoGuard.js";
import { DemoDependencies } from "../demo/DemoDependencies.js";
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

  const scenarioController = new ScenarioTriggerPostController(deps.triggerScenarioUseCase);
  const resetController = new DemoResetPostController(deps.demoResetUseCase);
  const statusController = new DemoStatusGetController(queryBus);

  // 決済/在庫モードは単独エンドポイントを公開しない。シナリオ注入が EC へ内部設定する
  // （「設定＋発火」を1ユースケースに閉じる）。EC 側の /demo/payment-mode は gateway 経由で利用。
  router.post("/demo/scenario/:id/trigger", scenarioController.run.bind(scenarioController));
  router.post("/demo/reset", resetController.run.bind(resetController));
  router.get("/demo/status", statusController.run.bind(statusController));
}

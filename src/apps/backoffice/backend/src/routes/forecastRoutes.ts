import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { RiskForecastRepository } from "../../../../../Contexts/Monitoring/Forecast/domain/ForecastBriefing.js";
import { forecastGuard } from "../middleware/forecastGuard.js";
import { demoGuard } from "../middleware/demoGuard.js";
import { ForecastGetController } from "../controllers/forecast/ForecastGetController.js";
import { ForecastPostController } from "../controllers/forecast/ForecastPostController.js";
import { ForecastResetController } from "../controllers/forecast/ForecastResetController.js";

export type ForecastDependencies = {
  riskForecastRepository: RiskForecastRepository;
  horizon: string;
};

export function registerForecastRoutes(
  router: Router,
  commandBus: CommandBus,
  deps: ForecastDependencies,
): void {
  // FORECAST_ENABLED=false（既定）では /forecast をまとめて 404 にする
  router.use("/forecast", forecastGuard);

  const getController = new ForecastGetController(deps.riskForecastRepository);
  const postController = new ForecastPostController(
    commandBus,
    deps.riskForecastRepository,
    deps.horizon,
  );
  const resetController = new ForecastResetController(deps.riskForecastRepository);

  // GET は事前生成済みキャッシュ（無人閲覧・課金ゼロ）。POST/DELETE はデモ操作＝ DEMO_ENABLED 配下。
  router.get("/forecast", getController.run.bind(getController));
  router.post("/forecast", demoGuard, postController.run.bind(postController));
  router.delete("/forecast", demoGuard, resetController.run.bind(resetController));
}

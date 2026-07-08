import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { SSEAlertNotifier } from "../../../../../Contexts/Monitoring/AlertNotification/domain/SSEAlertNotifier.js";
import { CollectMonitoringEventUseCase } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { RecordRemediationResultUseCase } from "../../../../../Contexts/Monitoring/AIInvestigation/application/RecordRemediationResult/RecordRemediationResultUseCase.js";
import { PendingInfraPlanStore } from "../../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/PendingInfraPlanStore.js";
import { DemoDependencies } from "../demo/DemoDependencies.js";
import { registerAlertRoutes } from "./alertRoutes.js";
import { registerEvidenceRoutes } from "./evidenceRoutes.js";
import { registerRemediationRoutes } from "./remediationRoutes.js";
import { registerStreamRoutes } from "./streamRoutes.js";
import { registerPatternRoutes } from "./patternRoutes.js";
import { registerAnalyticsRoutes } from "./analyticsRoutes.js";
import { registerDemoRoutes } from "./demoRoutes.js";
import { registerIngestRoutes } from "./ingestRoutes.js";
import { ForecastDependencies, registerForecastRoutes } from "./forecastRoutes.js";

export type IngestDependencies = {
  collectMonitoringEventUseCase: CollectMonitoringEventUseCase;
  recordRemediationResultUseCase: RecordRemediationResultUseCase;
  pendingInfraPlanStore: PendingInfraPlanStore;
  ingestToken: string;
};

export function registerRoutes(
  router: Router,
  commandBus: CommandBus,
  queryBus: QueryBus,
  sseNotifier: SSEAlertNotifier,
  demoDeps: DemoDependencies,
  ingestDeps: IngestDependencies,
  forecastDeps: ForecastDependencies,
): void {
  // /alerts/stream を /alerts/:id より先に登録する（後者が "stream" を id として捕捉するのを防ぐ）
  registerStreamRoutes(router, sseNotifier);
  registerAlertRoutes(router, commandBus, queryBus);
  registerEvidenceRoutes(router, queryBus);
  registerRemediationRoutes(router, commandBus, queryBus);
  registerPatternRoutes(router, commandBus, queryBus);
  registerAnalyticsRoutes(router, queryBus);
  registerDemoRoutes(router, queryBus, demoDeps);
  registerForecastRoutes(router, commandBus, forecastDeps);
  registerIngestRoutes(
    router,
    ingestDeps.collectMonitoringEventUseCase,
    ingestDeps.recordRemediationResultUseCase,
    ingestDeps.pendingInfraPlanStore,
    ingestDeps.ingestToken,
  );
}

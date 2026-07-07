import { Router } from "express";
import { CollectMonitoringEventUseCase } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { RecordRemediationResultUseCase } from "../../../../../Contexts/Monitoring/AIInvestigation/application/RecordRemediationResult/RecordRemediationResultUseCase.js";
import { PendingInfraPlanStore } from "../../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/PendingInfraPlanStore.js";
import { CloudMonitoringAlertIngestController } from "../controllers/ingest/CloudMonitoringAlertIngestController.js";
import { SecurityScanIngestPostController } from "../controllers/ingest/SecurityScanIngestPostController.js";
import { RemediationResultIngestPostController } from "../controllers/ingest/RemediationResultIngestPostController.js";
import { TerraformPlanIngestPostController } from "../controllers/ingest/TerraformPlanIngestPostController.js";

/**
 * 検知ソースからの ingest 境界ルート群。
 * 検知（detection）は上流（Cloud Monitoring / CI）の責務で、ここは発火済みアラートを受けて
 * MonitoringEvent に正規化するだけ。EC 自前イベントは RabbitMQ Subscriber 側の peer。
 * remediation-result は CI(AIリメディジョブ) からの結果 callback。
 * terraform-plan は CI(plan ジョブ) からの未適用 plan 投入（予兆の FUTURE_CHANGE シグナル源）。
 */
export function registerIngestRoutes(
  router: Router,
  collectMonitoringEventUseCase: CollectMonitoringEventUseCase,
  recordRemediationResultUseCase: RecordRemediationResultUseCase,
  pendingInfraPlanStore: PendingInfraPlanStore,
  ingestToken: string,
): void {
  const cloudMonitoringController = new CloudMonitoringAlertIngestController(
    collectMonitoringEventUseCase,
    ingestToken,
  );
  const securityScanController = new SecurityScanIngestPostController(
    collectMonitoringEventUseCase,
    ingestToken,
  );
  const remediationResultController = new RemediationResultIngestPostController(
    recordRemediationResultUseCase,
    ingestToken,
  );
  const terraformPlanController = new TerraformPlanIngestPostController(
    pendingInfraPlanStore,
    ingestToken,
  );

  router.post(
    "/ingest/cloud-monitoring",
    cloudMonitoringController.run.bind(cloudMonitoringController),
  );
  router.post(
    "/ingest/security-scan",
    securityScanController.run.bind(securityScanController),
  );
  router.post(
    "/ingest/remediation-result",
    remediationResultController.run.bind(remediationResultController),
  );
  router.post(
    "/ingest/terraform-plan",
    terraformPlanController.run.bind(terraformPlanController),
  );
}

import { Router } from "express";
import { CollectMonitoringEventUseCase } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { CloudMonitoringAlertIngestController } from "../controllers/ingest/CloudMonitoringAlertIngestController.js";
import { SecurityScanIngestPostController } from "../controllers/ingest/SecurityScanIngestPostController.js";

/**
 * 検知ソースからの ingest 境界ルート群。
 * 検知（detection）は上流（Cloud Monitoring / CI）の責務で、ここは発火済みアラートを受けて
 * MonitoringEvent に正規化するだけ。EC 自前イベントは RabbitMQ Subscriber 側の peer。
 */
export function registerIngestRoutes(
  router: Router,
  collectMonitoringEventUseCase: CollectMonitoringEventUseCase,
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

  router.post(
    "/ingest/cloud-monitoring",
    cloudMonitoringController.run.bind(cloudMonitoringController),
  );
  router.post(
    "/ingest/security-scan",
    securityScanController.run.bind(securityScanController),
  );
}

import { NextFunction, Request, Response } from "express";
import { CollectMonitoringEventUseCase } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { CloudMonitoringAlertTranslator } from "./CloudMonitoringAlertTranslator.js";

/**
 * POST /ingest/cloud-monitoring
 * Cloud Monitoring の Alerting Policy 発火（Webhook 通知 / Pub/Sub push）を受ける検知ソース境界。
 * 源固有 JSON を MonitoringEvent へ正規化し、EC 由来と同じ観測パイプライン
 * （CollectMonitoringEventUseCase → AnalyzeAlert）へ合流させる。
 *
 * Datadog を使わず Cloud Monitoring（GCP・無料枠）の検知の上に乗る、という物語の実体。
 */
export class CloudMonitoringAlertIngestController {
  constructor(
    private readonly collectMonitoringEventUseCase: CollectMonitoringEventUseCase,
    // 空文字なら認証なし（ローカル/デモ）。設定時は x-ingest-token 一致を要求する。
    private readonly ingestToken: string,
  ) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (this.ingestToken && req.header("x-ingest-token") !== this.ingestToken) {
        res.status(401).json({ error: "invalid ingest token" });
        return;
      }

      const monitoringEvent = CloudMonitoringAlertTranslator.toMonitoringEvent(
        req.body,
      );
      await this.collectMonitoringEventUseCase.run(monitoringEvent);
      res.status(202).json({ accepted: true, eventName: monitoringEvent.eventName });
    } catch (error) {
      next(error);
    }
  }
}

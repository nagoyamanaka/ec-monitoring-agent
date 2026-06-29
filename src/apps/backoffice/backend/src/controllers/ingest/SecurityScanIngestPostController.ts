import { NextFunction, Request, Response } from "express";
import { CollectMonitoringEventUseCase } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import {
  SecurityScanBody,
  SecurityScanTranslator,
} from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/SecurityScanTranslator.js";

/**
 * POST /ingest/security-scan
 * CI（GitHub Actions の Trivy/npm audit）からのスキャン結果を受ける検知ソース境界。
 * 源固有 JSON の正規化は SecurityScanTranslator（Monitoring コンテキストの CollectMonitoringEvent）に委ね、
 * EC 由来・Cloud Monitoring 由来と同じ観測パイプライン（CollectMonitoringEventUseCase → AnalyzeAlert）へ合流させる。
 * コントローラは認証・パース・HTTP 応答だけの薄い境界に保つ。
 *
 * 代表CVE の severity が HIGH/CRITICAL 未満なら Translator が info にマップ → isAlertable()=false。
 * その場合は 204 で黙って無視（CI への「受領したが無視」シグナル）。
 */
export class SecurityScanIngestPostController {
  constructor(
    private readonly collectMonitoringEventUseCase: CollectMonitoringEventUseCase,
    private readonly ingestToken: string,
  ) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (this.ingestToken && req.header("x-ingest-token") !== this.ingestToken) {
        res.status(401).json({ error: "invalid ingest token" });
        return;
      }

      const body = req.body as SecurityScanBody;
      const monitoringEvent = SecurityScanTranslator.toMonitoringEvent(body);

      if (!monitoringEvent.isAlertable()) {
        res.status(204).end();
        return;
      }

      await this.collectMonitoringEventUseCase.run(monitoringEvent);
      const vulnerabilityCount = Array.isArray(body.vulnerabilities)
        ? body.vulnerabilities.length
        : 0;
      res.status(202).json({ accepted: true, vulnerabilityCount });
    } catch (error) {
      next(error);
    }
  }
}

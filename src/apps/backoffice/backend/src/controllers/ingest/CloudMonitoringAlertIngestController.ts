import { NextFunction, Request, Response } from "express";
import { CollectMonitoringEventUseCase } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import { CloudMonitoringAlertTranslator } from "../../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CloudMonitoringAlertTranslator.js";

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
      if (this.ingestToken) {
        // 3 経路のいずれかで INGEST_TOKEN と一致すれば通す:
        //  - x-ingest-token ヘッダ（CI）
        //  - ?token= クエリ（旧 webhook_tokenauth 互換）
        //  - Authorization: Basic のパスワード（Cloud Monitoring webhook_basicauth）
        //    ※ webhook_tokenauth の token は GCP 生成で固定できないため basicauth を採用し、
        //      password=INGEST_TOKEN で照合する（username は任意・照合しない）。
        const headerToken = req.header("x-ingest-token");
        const queryToken = typeof req.query["token"] === "string" ? req.query["token"] : undefined;
        const basicAuthPassword = extractBasicAuthPassword(req.header("authorization"));
        if (
          headerToken !== this.ingestToken &&
          queryToken !== this.ingestToken &&
          basicAuthPassword !== this.ingestToken
        ) {
          res.status(401).json({ error: "invalid ingest token" });
          return;
        }
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

// "Authorization: Basic base64(user:pass)" から pass 部分だけ取り出す。
// 形式不正なら undefined（＝照合不成立）。username は照合に使わない。
function extractBasicAuthPassword(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const match = /^Basic\s+(.+)$/i.exec(authorization.trim());
  if (!match) return undefined;
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    return sep === -1 ? undefined : decoded.slice(sep + 1);
  } catch {
    return undefined;
  }
}

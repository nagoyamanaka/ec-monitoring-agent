import { Request, Response } from "express";
import { SSEAlertNotifier } from "../../../../../../Contexts/Monitoring/AlertNotification/domain/SSEAlertNotifier.js";

const HEARTBEAT_INTERVAL_MS = 30_000;

export class AlertsStreamController {
  constructor(private readonly sseNotifier: SSEAlertNotifier) {}

  run(req: Request, res: Response): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    this.sseNotifier.addConnection(res);

    // 30秒ごとにコメント行を送り、プロキシ/Cloud Run のアイドルタイムアウトを回避する
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, HEARTBEAT_INTERVAL_MS);

    req.on("close", () => {
      clearInterval(heartbeat);
      this.sseNotifier.removeConnection(res);
    });
  }
}

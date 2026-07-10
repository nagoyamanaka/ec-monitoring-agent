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

    // Cloud Run(GFE) は最初の body バイトが出るまでレスポンスヘッダを転送しない。
    // コメント行を即時に1つ書いてヘッダを押し出し、EventSource の onopen を
    // 初回 heartbeat（30秒後）まで待たせない（待たせると接続インジケータが
    // 最大30秒アンバーのままになる）。
    res.write(": connected\n\n");

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

import { Response } from "express";
import { AlertPrimitives } from "../../AlertAnalysis/domain/Alert.js";
import { RemediationResponsePrimitives } from "../../AIInvestigation/domain/contracts/RemediationContract.js";
import { SSEAlertNotifier } from "../domain/SSEAlertNotifier.js";

// オンメモリ（シングルプロセス前提）の SSE 通知実装。
// 接続中の Response を保持し、Alert 更新を全接続へ即時 push する。
// スケールアウト時は同 interface のまま RedisSSEAlertNotifier に差し替える。
export class EventEmitterSSEAlertNotifier implements SSEAlertNotifier {
  private readonly connections: Set<Response> = new Set();

  addConnection(res: Response): void {
    this.connections.add(res);
    // クライアント切断時に自動でクリーンアップ（コントローラ側の close 配線と二重でも冪等）
    res.on("close", () => this.removeConnection(res));
  }

  removeConnection(res: Response): void {
    this.connections.delete(res);
  }

  notify(alertPrimitives: AlertPrimitives): void {
    // 既定イベント（event 名なし）＝frontend の EventSource.onmessage が受ける。
    this.broadcast(JSON.stringify(alertPrimitives));
  }

  notifyRemediation(remediation: RemediationResponsePrimitives): void {
    // 名前付きイベント "remediation" ＝frontend は addEventListener("remediation") で受ける。
    this.broadcast(JSON.stringify(remediation), "remediation");
  }

  // 全接続へ1メッセージを書き込む。event 名があれば `event:` 行を付ける。
  private broadcast(data: string, eventName?: string): void {
    const frame = (eventName ? `event: ${eventName}\n` : "") + `data: ${data}\n\n`;
    for (const res of this.connections) {
      // 1接続の書き込み失敗で他接続への push を止めない
      try {
        res.write(frame);
      } catch {
        this.removeConnection(res);
      }
    }
  }
}

import { Response } from "express";
import { AlertPrimitives } from "../../AlertAnalysis/domain/Alert.js";
import { RemediationResponsePrimitives } from "../../AIInvestigation/domain/contracts/RemediationContract.js";
import { SSEAlertNotifier } from "../domain/SSEAlertNotifier.js";
import { EventEmitterSSEAlertNotifier } from "./EventEmitterSSEAlertNotifier.js";
import { ValkeyConnection } from "../../../Shared/infrastructure/valkey/ValkeyConnection.js";

/**
 * 多インスタンス SSE の fan-out（stretchⅠ・案1）。`SSEAlertNotifier` をそのまま実装するので
 * consumer（UseCase / AlertsStreamController）はノータッチ＝composition root の差し替えのみで載る。
 *
 * 経路（worker / edge ロール分離前提）:
 *  - notify / notifyRemediation … Valkey channel に publish（どのプロセスが処理したかに依らない）
 *  - startFanOut() … channel を購読し、受信を接続中の各 SSE クライアントへ fan-out（接続管理は
 *    既存 EventEmitterSSEAlertNotifier に委譲＝SSE 書き込み/heartbeat/close の機構を再利用）
 *
 * publish も subscribe も「単一の fan-out 経路」に収れんさせる: notify はローカルへ直接書かず必ず
 * publish し、購読ループ（自プロセス含む全 edge）が唯一の配信点になる。worker は SSE クライアントを
 * 持たないので startFanOut を呼ばない（publish だけ）。
 *
 * Valkey down 時は best-effort（§11.3）: publish 失敗は握りつぶし、frontend 再接続時の再フェッチで
 * ギャップを埋める。SoT は Mongo 側にあり、ここで欠落しても「障害」でなく「性能劣化」に留まる。
 */
export class RedisSSEAlertNotifier implements SSEAlertNotifier {
  static readonly ALERT_CHANNEL = "monitoring:sse:alert";
  static readonly REMEDIATION_CHANNEL = "monitoring:sse:remediation";

  constructor(
    private readonly valkey: ValkeyConnection,
    private readonly local: EventEmitterSSEAlertNotifier = new EventEmitterSSEAlertNotifier(),
  ) {}

  /**
   * edge / all 用：Valkey 購読を張り、受信を接続中の SSE クライアントへ fan-out する。
   * worker（SSE クライアントを持たない）では呼ばない＝購読接続を無駄に張らない。
   */
  async startFanOut(): Promise<void> {
    await this.valkey.subscribe(
      [
        RedisSSEAlertNotifier.ALERT_CHANNEL,
        RedisSSEAlertNotifier.REMEDIATION_CHANNEL,
      ],
      (channel, message) => {
        try {
          const payload = JSON.parse(message);
          if (channel === RedisSSEAlertNotifier.REMEDIATION_CHANNEL) {
            this.local.notifyRemediation(payload as RemediationResponsePrimitives);
          } else {
            this.local.notify(payload as AlertPrimitives);
          }
        } catch {
          // 壊れた / 非 JSON のメッセージは捨てる（best-effort）
        }
      },
    );
  }

  notify(alertPrimitives: AlertPrimitives): void {
    void this.valkey.publish(
      RedisSSEAlertNotifier.ALERT_CHANNEL,
      JSON.stringify(alertPrimitives),
    );
  }

  notifyRemediation(remediation: RemediationResponsePrimitives): void {
    void this.valkey.publish(
      RedisSSEAlertNotifier.REMEDIATION_CHANNEL,
      JSON.stringify(remediation),
    );
  }

  addConnection(res: Response): void {
    this.local.addConnection(res);
  }

  removeConnection(res: Response): void {
    this.local.removeConnection(res);
  }
}

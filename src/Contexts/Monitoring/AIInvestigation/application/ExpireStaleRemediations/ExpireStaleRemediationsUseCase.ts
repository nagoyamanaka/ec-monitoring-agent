import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";
import { RemediationRepository } from "../../domain/remediation/RemediationRepository.js";
import {
  dispatchExpiryThreshold,
  expireDispatched,
} from "../../domain/remediation/RemediationExpiry.js";
import { remediationRecordToPrimitives } from "../../domain/contracts/RemediationContract.js";

/**
 * callback が来ないまま期限を過ぎた dispatched を failed へ落とす。
 *
 * dispatch 経路の確定（RecordRemediationResult）は CI からの POST に依存する。ジョブが落ちる・
 * 宛先が未配線・ネットワークが切れる、のどれでも record は dispatched のまま永久に残るので、
 * 受け手側で時間終端させる。**CI の誠実さに依存しない**形にしてあるので、将来 dispatch 以外の
 * 非同期 executor を足しても同じ終端が効く。
 *
 * 確定と同じく SSE で push する（dispatched で待っている画面をその場で切り替える）。
 */
export class ExpireStaleRemediationsUseCase {
  constructor(
    private readonly remediationRepository: RemediationRepository,
    private readonly sseNotifier: SSEAlertNotifier,
    private readonly logger: Logger,
    private readonly timeoutMs: number,
  ) {}

  /** 落とした件数を返す（0 なら何もしない＝ログも出さない）。 */
  async run(now: Date = new Date()): Promise<number> {
    const stale = await this.remediationRepository.findStaleDispatched(
      dispatchExpiryThreshold(now, this.timeoutMs),
    );
    if (stale.length === 0) return 0;

    for (const record of stale) {
      const expired = expireDispatched(record, now, this.timeoutMs);
      await this.remediationRepository.save(expired);
      this.sseNotifier.notifyRemediation(
        remediationRecordToPrimitives(expired.alertId, expired),
      );
      await this.logger.warn({
        service: "backoffice-backend",
        action: "remediation_dispatch_expired",
        message: `CIからの結果が期限内に届かず failed へ確定：${record.alertId}, dispatchedAt=${record.createdAt.toISOString()}, timeoutMs=${this.timeoutMs}`,
      });
    }

    return stale.length;
  }
}

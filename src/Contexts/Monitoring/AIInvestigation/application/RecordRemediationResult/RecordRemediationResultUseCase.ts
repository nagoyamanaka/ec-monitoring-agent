import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { SSEAlertNotifier } from "../../../AlertNotification/domain/SSEAlertNotifier.js";
import { RemediationRepository } from "../../domain/remediation/RemediationRepository.js";
import { RemediationRecord, RemediationStatus } from "../../domain/remediation/RemediationRecord.js";
import { remediationRecordToPrimitives } from "../../domain/contracts/RemediationContract.js";

/**
 * CI（GitHub Actions のAIリメディジョブ）からの最終結果を受けて RemediationRecord を確定する。
 * dispatched（受付）→ drafted（PR起票成功）/ skipped（テストゲートは緑だが直す変更が無かった）/
 * failed（修正不能・UT落ち等）への遷移。
 * vulnerabilityCount は dispatch 時に記録済みの値を保つ（CI は件数を知らなくてよい）。
 *
 * この確定は dispatch 経路では非同期（CI 完了は数分後）でクライアント操作が起点に無いため、
 * SSE で push してフロントの「dispatched 表示」を即座に確定させる（ポーリング不要・段階2の設計統一）。
 */
export class RecordRemediationResultUseCase {
  constructor(
    private readonly remediationRepository: RemediationRepository,
    private readonly sseNotifier: SSEAlertNotifier,
    private readonly logger: Logger,
  ) {}

  async run(params: {
    alertId: string;
    status: Extract<RemediationStatus, "drafted" | "skipped" | "failed">;
    pullRequestUrl?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const existing = await this.remediationRepository.findByAlertId(params.alertId);

    const record: RemediationRecord = {
      alertId: params.alertId,
      status: params.status,
      pullRequestUrl: params.pullRequestUrl ?? null,
      vulnerabilityCount: existing?.vulnerabilityCount ?? 0,
      reason: params.reason ?? null,
      createdAt: new Date(),
    };
    await this.remediationRepository.save(record);

    // 確定をリアルタイムに反映（dispatched で待っている画面へ push）。
    this.sseNotifier.notifyRemediation(
      remediationRecordToPrimitives(params.alertId, record),
    );

    await this.logger.info({
      service: "backoffice-backend",
      action: "remediation_result_recorded",
      message: `CIからリメディ結果受領：${params.alertId}, status=${params.status}, url=${params.pullRequestUrl ?? "-"}`,
    });
  }
}

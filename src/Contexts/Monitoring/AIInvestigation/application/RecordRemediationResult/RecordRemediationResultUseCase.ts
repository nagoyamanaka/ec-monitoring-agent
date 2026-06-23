import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { RemediationRepository } from "../../Remediation/domain/RemediationRepository.js";
import { RemediationStatus } from "../../Remediation/domain/RemediationRecord.js";

/**
 * CI（GitHub Actions のAIリメディジョブ）からの最終結果を受けて RemediationRecord を確定する。
 * dispatched（受付）→ drafted（PR起票成功）/ failed（修正不能・UT落ち等）への遷移。
 * vulnerabilityCount は dispatch 時に記録済みの値を保つ（CI は件数を知らなくてよい）。
 */
export class RecordRemediationResultUseCase {
  constructor(
    private readonly remediationRepository: RemediationRepository,
    private readonly logger: Logger,
  ) {}

  async run(params: {
    alertId: string;
    status: Extract<RemediationStatus, "drafted" | "failed">;
    pullRequestUrl?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const existing = await this.remediationRepository.findByAlertId(params.alertId);

    await this.remediationRepository.save({
      alertId: params.alertId,
      status: params.status,
      pullRequestUrl: params.pullRequestUrl ?? null,
      vulnerabilityCount: existing?.vulnerabilityCount ?? 0,
      reason: params.reason ?? null,
      createdAt: new Date(),
    });

    await this.logger.info({
      service: "backoffice-backend",
      action: "remediation_result_recorded",
      message: `CIからリメディ結果受領：${params.alertId}, status=${params.status}, url=${params.pullRequestUrl ?? "-"}`,
    });
  }
}

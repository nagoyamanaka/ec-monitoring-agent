import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { AlertRepository } from "../../../AlertAnalysis/domain/AlertRepository.js";
import { MonitoringResourceNotFoundError } from "../../../AlertAnalysis/application/errors/MonitoringResourceNotFoundError.js";
import { RemediationExecutor } from "../../domain/remediation/RemediationExecutor.js";
import { vulnerabilitiesFromPayload } from "../../domain/remediation/RemediationInput.js";
import { RemediationRecord } from "../../domain/remediation/RemediationRecord.js";
import { RemediationRepository } from "../../domain/remediation/RemediationRepository.js";

/**
 * security-scan アラートの payload.vulnerabilities[] を入力に修正を実行する。
 * シナリオ5（DevOpsループ）の出口。write 操作はここに集約する。
 *
 * 実行戦略（その場で草案PR＝advisory / CI へAIエージェントをディスパッチ＝agentic）は
 * RemediationExecutor の実装差し替えで決まり、本 UseCase は outcome を記録に写すだけ。
 * - 対象脆弱性が無ければ実行せず skipped（非 security アラートへの誤呼び出しの安全弁）。
 * - dispatched は受付のみ（PR URL 無し）。確定は CI からの callback（RecordRemediationResult）。
 * - PR は draft 起票・自動マージなし（人間承認ゲートは GitHub 側のレビュー）。
 */
export class DraftRemediationUseCase {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly executor: RemediationExecutor,
    private readonly remediationRepository: RemediationRepository,
    private readonly logger: Logger,
  ) {}

  async run(alertId: AlertId): Promise<void> {
    const alert = await this.alertRepository.findById(alertId);
    if (alert === null) {
      throw new MonitoringResourceNotFoundError("Alert", alertId.value);
    }

    const vulnerabilities = vulnerabilitiesFromPayload(
      alert.monitoringEvent.payload,
    );

    if (vulnerabilities.length === 0) {
      await this.persist({
        alertId: alertId.value,
        status: "skipped",
        pullRequestUrl: null,
        vulnerabilityCount: 0,
        reason: "アラートに修正対象の脆弱性（payload.vulnerabilities）がありません",
      });
      return;
    }

    const repo =
      typeof alert.monitoringEvent.payload["repo"] === "string"
        ? (alert.monitoringEvent.payload["repo"] as string)
        : null;

    const outcome = await this.executor.execute({
      alertId: alertId.value,
      repo,
      vulnerabilities,
    });

    switch (outcome.kind) {
      case "drafted":
        await this.persist({
          alertId: alertId.value,
          status: "drafted",
          pullRequestUrl: outcome.pullRequestUrl,
          vulnerabilityCount: vulnerabilities.length,
          reason: null,
        });
        await this.logger.info({
          service: "backoffice-backend",
          action: "remediation_pr_drafted",
          message: `修正PR草案起票：${alertId.value}, url=${outcome.pullRequestUrl}, vulns=${vulnerabilities.length}`,
        });
        return;
      case "dispatched":
        await this.persist({
          alertId: alertId.value,
          status: "dispatched",
          pullRequestUrl: null,
          vulnerabilityCount: vulnerabilities.length,
          reason: null,
        });
        await this.logger.info({
          service: "backoffice-backend",
          action: "remediation_dispatched",
          message: `修正ジョブをCIへディスパッチ：${alertId.value}, vulns=${vulnerabilities.length}（結果は callback で確定）`,
        });
        return;
      case "failed":
        await this.persist({
          alertId: alertId.value,
          status: "failed",
          pullRequestUrl: null,
          vulnerabilityCount: vulnerabilities.length,
          reason: outcome.reason,
        });
        await this.logger.warn({
          service: "backoffice-backend",
          action: "remediation_failed",
          message: `修正の起票/ディスパッチ失敗：${alertId.value}, reason=${outcome.reason}`,
        });
        return;
    }
  }

  private async persist(record: Omit<RemediationRecord, "createdAt">): Promise<void> {
    await this.remediationRepository.save({ ...record, createdAt: new Date() });
  }
}

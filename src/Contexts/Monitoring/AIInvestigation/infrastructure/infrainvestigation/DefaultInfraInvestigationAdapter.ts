import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategories } from "../../../Shared/domain/MonitoringEventCategory.js";
import { InfraEvidence } from "../../domain/InfraEvidence.js";
import { InfraInvestigationPort } from "../../domain/InfraInvestigationPort.js";
import { CloudLoggingGateway } from "./CloudLoggingGateway.js";
import { GitHubGateway } from "./GitHubGateway.js";
import { TerraformGateway } from "./TerraformGateway.js";

// 証拠収集ウィンドウ（障害発生から遡る分数）
const EVIDENCE_WINDOW_MINUTES = 30;
const RECENT_COMMITS_LIMIT = 10;

// category に応じて収集する証拠源を出し分けるオーケストレーター。
// 各 Gateway 呼び出しはベストエフォート（失敗しても調査継続）。
export class DefaultInfraInvestigationAdapter implements InfraInvestigationPort {
  constructor(
    private readonly cloudLogging: CloudLoggingGateway,
    private readonly terraform: TerraformGateway,
    private readonly github: GitHubGateway,
  ) {}

  async collect(monitoringEvent: MonitoringEvent): Promise<InfraEvidence> {
    const category = monitoringEvent.category.value;
    const occurredOn = monitoringEvent.occurredOn;
    const since = new Date(occurredOn.getTime() - EVIDENCE_WINDOW_MINUTES * 60 * 1000);

    const appLogs = await this.tryCollectLogs(monitoringEvent.source, occurredOn);

    const terraformDiff =
      category === MonitoringEventCategories.INFRASTRUCTURE
        ? await this.tryGetTerraformDiff(since)
        : undefined;

    const recentCommits =
      category === MonitoringEventCategories.SECURITY
        ? await this.tryListCommits(since)
        : undefined;

    return {
      appLogs,
      ...(terraformDiff !== undefined ? { terraformDiff } : {}),
      ...(recentCommits !== undefined ? { recentCommits } : {}),
      collectedAt: new Date(),
    };
  }

  private async tryCollectLogs(
    service: string,
    occurredOn: Date,
  ): Promise<InfraEvidence["appLogs"]> {
    try {
      return await this.cloudLogging.getAppLogs({
        service,
        occurredOn,
        windowMinutes: EVIDENCE_WINDOW_MINUTES,
      });
    } catch {
      return [];
    }
  }

  private async tryGetTerraformDiff(since: Date) {
    try {
      return await this.terraform.getAppliedDiff({ since }) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private async tryListCommits(since: Date) {
    try {
      return await this.github.listRecentCommits({ since, limit: RECENT_COMMITS_LIMIT });
    } catch {
      return undefined;
    }
  }
}

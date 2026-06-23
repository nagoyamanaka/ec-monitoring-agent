import {
  RemediationExecutor,
  RemediationOutcome,
} from "../../domain/remediation/RemediationExecutor.js";
import { RemediationInput } from "../../domain/remediation/RemediationInput.js";
import { RemediationPlanner } from "../../domain/remediation/RemediationPlanner.js";
import { RemediationPort } from "../../domain/remediation/RemediationPort.js";

/**
 * その場で（バックエンドプロセス内で）修正方針を起草し草案PRを起票する advisory 経路。
 * 実コード修正＋UT/E2E は行わず、SECURITY_REMEDIATION.md の方針PRを出すのみ（人間が直す前提）。
 * GitHub/CI 不在でも動くため、ローカル/デモのフォールバックとして残す。
 * 実修正まで自動化する場合は GitHubActionsRemediationDispatcher（dispatch 経路）を使う。
 */
export class InProcessAdvisoryRemediation implements RemediationExecutor {
  constructor(
    private readonly planner: RemediationPlanner,
    private readonly port: RemediationPort,
  ) {}

  async execute(input: RemediationInput): Promise<RemediationOutcome> {
    const plan = await this.planner.plan(input);
    const result = await this.port.draftPullRequest(plan);
    return result.created
      ? { kind: "drafted", pullRequestUrl: result.pullRequestUrl }
      : { kind: "failed", reason: result.reason };
  }
}

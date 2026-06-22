import { RemediationPlan, RemediationResult } from "./RemediationPlan.js";

export interface RemediationPort {
  // 修正PRを「草案」として起票する。マージはしない（人間がレビュー）
  draftPullRequest(plan: RemediationPlan): Promise<RemediationResult>;
}

import { PendingPlan } from "./TerraformGateway.js";
import { PendingInfraPlanStore } from "./PendingInfraPlanStore.js";

// 未適用 plan のオンメモリ保管（単一プロセス前提・InMemoryAppliedInfraChangeStore と同型）。
// デモ／ローカルでは seed（F6/F8）が record し、予兆の PendingPlanSignalSource が listPending で引く。
// CI ingest（/ingest/terraform-plan）も同じ record 口へ積む。
export class InMemoryPendingInfraPlanStore implements PendingInfraPlanStore {
  private plans: PendingPlan[] = [];

  async record(plan: PendingPlan): Promise<void> {
    // 同一 url（＝同じ PR の plan 再実行）は最新で置換し、push のたびにシグナルが増殖しないようにする。
    // seed は url を持たないので常に素通し＝既存デモ（plan-1）の挙動は不変。
    if (plan.url) {
      this.plans = this.plans.filter((existing) => existing.url !== plan.url);
    }
    this.plans.push(plan);
  }

  async listPending(): Promise<PendingPlan[]> {
    return [...this.plans].sort(
      (a, b) => b.plannedAt.getTime() - a.plannedAt.getTime(),
    );
  }
}

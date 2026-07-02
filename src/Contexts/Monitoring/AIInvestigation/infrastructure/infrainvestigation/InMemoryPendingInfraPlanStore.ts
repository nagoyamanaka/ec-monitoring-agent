import { PendingPlan } from "./TerraformGateway.js";
import { PendingInfraPlanStore } from "./PendingInfraPlanStore.js";

// 未適用 plan のオンメモリ保管（単一プロセス前提・InMemoryAppliedInfraChangeStore と同型）。
// デモ／ローカルでは seed（F6/F8）が record し、予兆の PendingPlanSignalSource が listPending で引く。
export class InMemoryPendingInfraPlanStore implements PendingInfraPlanStore {
  private readonly plans: PendingPlan[] = [];

  async record(plan: PendingPlan): Promise<void> {
    this.plans.push(plan);
  }

  async listPending(): Promise<PendingPlan[]> {
    return [...this.plans].sort(
      (a, b) => b.plannedAt.getTime() - a.plannedAt.getTime(),
    );
  }
}

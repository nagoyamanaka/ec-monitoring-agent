import {
  AppliedInfraChange,
  AppliedInfraChangeStore,
} from "./AppliedInfraChangeStore.js";

// apply イベントのオンメモリ保管（単一プロセス前提）。
// デモ／ローカルでは demo 注入が record し、調査が findAppliedSince で引く。
// 実機では HTTP ingest（CI からの POST）を上流に差し替える想定（本クラスはその受け皿の最小実装）。
export class InMemoryAppliedInfraChangeStore implements AppliedInfraChangeStore {
  private readonly changes: AppliedInfraChange[] = [];

  async record(change: AppliedInfraChange): Promise<void> {
    this.changes.push(change);
  }

  async findAppliedSince(since: Date): Promise<AppliedInfraChange[]> {
    const sinceMs = since.getTime();
    return this.changes
      .filter((c) => c.appliedAt.getTime() >= sinceMs)
      .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());
  }
}

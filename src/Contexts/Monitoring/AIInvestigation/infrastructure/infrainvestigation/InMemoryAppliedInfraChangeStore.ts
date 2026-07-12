import {
  AppliedInfraChange,
  AppliedInfraChangeStore,
} from "./AppliedInfraChangeStore.js";

// apply イベントのオンメモリ保管（単一プロセス前提・テスト用）。
// アプリの配線は MongoAppliedInfraChangeStore（edge の record を worker の調査が読めるよう
// 共有 Mongo を SoT にする）。本クラスは UT の軽量 fake としてのみ使う。
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

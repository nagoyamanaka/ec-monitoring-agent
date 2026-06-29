import { TerraformDiff } from "../../domain/InfraEvidence.js";
import { TerraformGateway } from "./TerraformGateway.js";
import {
  AppliedInfraChange,
  AppliedInfraChangeStore,
} from "./AppliedInfraChangeStore.js";

// 適用済み IaC 差分を「apply 時に捕捉したイベント」から時間窓で引く（読み取り専用）。
//
// 以前は IaC リポジトリの `git log *.tf` で「どのファイルが触られたか」を集めていたが、
// それは *意図* であって *適用された事実* ではない（コミット済み≠apply 済み・computed 値/drift を取りこぼす）。
// AI 原因分析にとって価値があるのは「どのリソースのどの属性がどう変わったか」なので、
// apply の瞬間に構造化差分（resourceChanges）を記録した AppliedInfraChangeStore を唯一のソースにする。
export class TerraformGatewayImpl implements TerraformGateway {
  constructor(private readonly store: AppliedInfraChangeStore) {}

  async getAppliedDiff(params: { since: Date }): Promise<TerraformDiff | null> {
    const changes = await this.store.findAppliedSince(params.since);
    if (changes.length === 0) return null;

    // 窓内で最も新しい apply を採用する（障害に時間的に最も近い変更が原因に近い）。
    return toTerraformDiff(changes[0]);
  }
}

function toTerraformDiff(change: AppliedInfraChange): TerraformDiff {
  return {
    resourceChanges: change.resourceChanges,
    appliedAt: change.appliedAt.toISOString(),
    ...(change.commitSha ? { commitSha: change.commitSha } : {}),
    changedResources: change.resourceChanges.map((r) => r.address),
    summary: change.summary,
  };
}

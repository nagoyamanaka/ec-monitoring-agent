import { TerraformDiff } from "./InfraEvidence.js";

export interface TerraformGateway {
  // 指定日時以降に適用済みの IaC 差分を返す（読み取り専用）
  getAppliedDiff(params: { since: Date }): Promise<TerraformDiff | null>;
}

import { TerraformDiff, TerraformResourceChange } from "../../domain/InfraEvidence.js";

// 未適用の terraform plan（plan 済み・apply 待ち＝まだ起きていないインフラ変更）。
// AppliedInfraChange が「適用された事実」なのに対し、こちらは「適用されようとしている意図」。
export type PendingPlan = {
  readonly resourceChanges: TerraformResourceChange[];
  readonly plannedAt: Date;
  readonly summary: string; // 例: "cloudsql max_connections 100→40 縮小"
  readonly url?: string; // plan を積んだ PR / CI run へのリンク（引用チップからの実在解決に使う）
};

export interface TerraformGateway {
  // 指定日時以降に適用済みの IaC 差分を返す（読み取り専用）
  getAppliedDiff(params: { since: Date }): Promise<TerraformDiff | null>;
  // 未適用 plan を新しい順で返す（読み取り専用）。予兆（Forecast）の FUTURE_CHANGE シグナル源。
  getPendingPlan(): Promise<PendingPlan[]>;
}

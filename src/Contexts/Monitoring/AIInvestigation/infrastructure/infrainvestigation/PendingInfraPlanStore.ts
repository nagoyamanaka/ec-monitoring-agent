import { PendingPlan } from "./TerraformGateway.js";

// 未適用 plan の記録（write＝CI/デモ seed 注入）と照会（read＝予兆）の口。
// AppliedInfraChangeStore（適用済みの事実）と対になる「適用待ちの意図」の受け皿。
// 実機では plan パイプラインが `terraform show -json plan` の構造化差分を POST してここへ積む。
export interface PendingInfraPlanStore {
  record(plan: PendingPlan): Promise<void>;
  // 未適用 plan を新しい順（直近 plan が先頭）で返す。
  listPending(): Promise<PendingPlan[]>;
}

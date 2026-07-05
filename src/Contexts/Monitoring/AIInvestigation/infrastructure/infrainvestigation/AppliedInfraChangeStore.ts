import { TerraformResourceChange } from "../../domain/InfraEvidence.js";

// 適用時に捕捉した IaC 変更イベント（apply マーカー）。
// terraform apply は CI 上の一回限りの出来事で後から再構成できないため、適用の瞬間に記録し、
// 調査時に時間窓で引く（検知ソースを境界の外で peer ingest するのと同じ思想）。
// 実機では apply パイプラインが `terraform show -json` の構造化差分を POST してここへ積む。
export type AppliedInfraChange = {
  readonly appliedAt: Date;
  readonly resourceChanges: TerraformResourceChange[];
  // 由来コミット（任意）。join キーではなくイベントの一属性。
  readonly commitSha?: string;
  // 由来変更の Web リンク（GitHub の PR/コミット・任意）。証拠のクリック可能な原典になる。
  readonly url?: string;
  readonly summary: string;
};

// apply イベントの記録（write＝CI/デモ注入）と時間窓照会（read＝調査）の口。
export interface AppliedInfraChangeStore {
  record(change: AppliedInfraChange): Promise<void>;
  // since 以降に適用された変更を、新しい順（直近が先頭）で返す。
  findAppliedSince(since: Date): Promise<AppliedInfraChange[]>;
}

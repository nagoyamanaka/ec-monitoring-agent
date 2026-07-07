import { PendingPlan } from "../AIInvestigation/infrastructure/infrainvestigation/TerraformGateway.js";

/**
 * 予兆フラッグシップ（F8・DB接続枯渇）の未適用 terraform plan seed（id=plan-1）。
 * DEMO_ENABLED 配下で InMemoryPendingInfraPlanStore に record し、
 * PendingPlanSignalSource が FUTURE_CHANGE シグナルとして拾う。
 *
 * ★実在リソースの本物 plan にした（2026-07-08・捏造回避）:
 * 対象は infra/terraform に**実在する** `module.gce_backbone.google_compute_instance.backbone`
 * （RabbitMQ+Mongo+ES+Valkey+worker 同居 VM＝本番 DB(Mongo) のホスト）の `machine_type` を
 * コスト最適化で `e2-standard-2 → e2-small` に縮小する plan。実際に PR（#83）を出せば CI の
 * terraform plan ジョブ（D2/D3）が**本物の plan を生成**し、その PR へ引用チップから飛べる。
 * VM 縮小＝Mongo がメモリ/接続を捌けず接続枯渇の再来リスク、という予兆テーマにも合致する。
 *
 * 先頭リソースの address が予兆の subject（突合キー）になるため、過去インシデント seed
 * （ResolvedAlertSeed の poolShrinkRegression・report.subject="google_compute_instance.backbone"）
 * とトークン突合する（google/compute/instance/backbone を共有）＝「同じ VM で過去に枯渇した」
 * MEMORY 突合が成立する。url は withPendingPlanEvidenceUrl で env（実 PR）から後付けする。
 */
export const FORECAST_PENDING_PLAN_SEED: PendingPlan[] = [
  {
    resourceChanges: [
      {
        address: "module.gce_backbone.google_compute_instance.backbone",
        action: "update",
        attributeDeltas: [
          { key: "machine_type", before: "e2-standard-2", after: "e2-small" },
        ],
      },
    ],
    plannedAt: new Date("2026-07-08T09:00:00.000Z"),
    summary:
      "バックボーンVM（Mongo 同居）を e2-standard-2 → e2-small に縮小（コスト最適化・plan済み未適用）",
  },
];

/**
 * seed（fixture）に「証拠を開く」deep link を後付けする（純粋関数・seed 本体は不変に保つ）。
 * url は実 PR（#83＝上記 VM 縮小 plan が CI で本物の plan を生成した PR）を指す。
 * DEMO_INFRA_APPLY_PR_URL（scenario3/3b の適用済み証拠 PR）と同じ「事前起票した本物を毎回指す」割り切り。
 * url が空文字なら url を付けない（非リンク表示）。既に url を持つ plan（CI ingest 由来）は上書きしない。
 */
export function withPendingPlanEvidenceUrl(
  plans: PendingPlan[],
  url: string,
): PendingPlan[] {
  if (!url) {
    return plans;
  }
  return plans.map((plan) => (plan.url ? plan : { ...plan, url }));
}

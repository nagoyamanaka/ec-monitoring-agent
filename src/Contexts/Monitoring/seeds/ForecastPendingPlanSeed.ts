import { PendingPlan } from "../AIInvestigation/infrastructure/infrainvestigation/TerraformGateway.js";

/**
 * 予兆フラッグシップ（F8・§3.1 DB接続枯渇）の未適用 terraform plan seed。
 * DEMO_ENABLED 配下で InMemoryPendingInfraPlanStore に record し、
 * PendingPlanSignalSource が FUTURE_CHANGE シグナル（id=plan-1）として拾う。
 * 実機では CI の plan パイプラインが同じ record 口へ構造化差分を積む想定のデモ値。
 *
 * 先頭リソースの address が予兆の subject（突合キー）になるため、過去インシデント seed
 * （ResolvedAlertSeed の report.subject="google_sql_database_instance.ec_db"）と同語彙に
 * 揃えている＝「同じ Cloud SQL リソースで過去に枯渇した」MEMORY 突合が成立する。
 */
export const FORECAST_PENDING_PLAN_SEED: PendingPlan[] = [
  {
    resourceChanges: [
      {
        address: "google_sql_database_instance.ec_db",
        action: "update",
        attributeDeltas: [
          { key: "settings.database_flags.max_connections", before: "100", after: "40" },
        ],
      },
    ],
    plannedAt: new Date("2026-07-03T10:00:00.000Z"),
    summary: "Cloud SQL max_connections 100→40 縮小（コスト最適化・plan済み未適用）",
  },
];

/**
 * seed（fixture）に「証拠を開く」deep link を後付けする（純粋関数・seed 本体は不変に保つ）。
 * infraApplyPrUrl（適用済み 100→20 の過去証拠 PR）と対になる、未適用 plan（100→40・未来）の
 * 証拠 PR を env 経由で注入する。DEMO_INFRA_APPLY_PR_URL と同じ「事前起票した本物を毎回指す」割り切り。
 * url が空文字（未設定）なら url を付けない＝撮影済みのリンク無し表示をそのまま維持する。
 * 既に url を持つ plan（CI ingest 由来など）は上書きしない。
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

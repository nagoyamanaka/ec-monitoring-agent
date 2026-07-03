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

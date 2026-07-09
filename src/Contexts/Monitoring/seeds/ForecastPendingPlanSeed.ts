import { PendingPlan } from "../AIInvestigation/infrastructure/infrainvestigation/TerraformGateway.js";

/**
 * plan の先頭リソース address（＝引用チップ「証拠を開く」の解決先 PR を後付けする突合キー）。
 * plan ごとに別々の実 PR を指すため、address → url の対応で線引きする（捏造ガード）。
 * - flagship（VM 縮小）→ 実 PR #83（CI の terraform plan が本物の差分を生成）
 * - Valkey（メモリ縮小）→ 実 draft PR（compose の Valkey maxmemory 縮小・env で後付け）
 * url を持たない address（未対応の合成 plan）には何も付けない＝非リンクのまま。
 */
export const FORECAST_FLAGSHIP_PLAN_ADDRESS =
  "module.gce_backbone.google_compute_instance.backbone";
export const FORECAST_VALKEY_PLAN_ADDRESS =
  "module.valkey_cache.google_redis_instance.catalog_cache";

/**
 * 予兆シナリオの未適用 terraform plan seed（FUTURE_CHANGE シグナル源）。
 * DEMO_ENABLED 配下で InMemoryPendingInfraPlanStore に record し、
 * PendingPlanSignalSource が id=plan-1, plan-2… で拾う（配列順＝id 連番）。
 *
 * plan-1（flagship・DB接続枯渇）★実在リソースの本物 plan（2026-07-08・捏造回避）:
 * 対象は infra/terraform に**実在する** `module.gce_backbone.google_compute_instance.backbone`
 * （RabbitMQ+Mongo+ES+Valkey+worker 同居 VM＝本番 DB(Mongo) のホスト）の `machine_type` を
 * コスト最適化で `e2-standard-2 → e2-small` に縮小する plan。実際に PR（#83）を出せば CI の
 * terraform plan ジョブ（D2/D3）が**本物の plan を生成**し、その PR へ引用チップから飛べる。
 * 先頭リソースの address が予兆の subject（突合キー）になり、過去インシデント seed
 * （ResolvedAlertSeed の poolShrinkRegression・report.subject="google_compute_instance.backbone"）
 * とトークン突合する（google/compute/instance/backbone を共有）＝「同じ VM で過去に枯渇した」
 * MEMORY 突合が成立する。url は withPendingPlanEvidenceUrls で env（実 PR #83）から後付けする。
 *
 * plan-2（2本目・Valkey キャッシュ・カスケード）は**合成 seed**（terraform リソース address は合成）:
 * カタログキャッシュ（Valkey）の maxmemory 縮小で eviction 増→ヒット率低下→DB 直撃という
 * 「キャッシュ層の変更がプール枯渇に伝播する」別経路を、flagship と同じ結論
 * （db_connection_pool_exhaustion）へ収束させる。address に valkey/cache トークンを含め、
 * 過去インシデント seed（valkeyTtlRegression / valkeyMemoryShrink・report.subject に valkey+cache）と
 * トークン突合する。**非リンクの合成 seed のまま**にする＝Valkey は VM 上の compose プロセスで
 * terraform 単独リソースを持たず、本物の terraform plan を作れない（VM metadata 経由にすると address が
 * backbone VM になり flagship と subject 衝突するため不採用）。Valkey シナリオの実クリック証拠は
 * 過去インシデント（inc-3/4→実 Alert）が担保する。
 */
export const FORECAST_PENDING_PLAN_SEED: PendingPlan[] = [
  {
    resourceChanges: [
      {
        address: FORECAST_FLAGSHIP_PLAN_ADDRESS,
        action: "update",
        attributeDeltas: [
          { key: "machine_type", before: "e2-standard-2", after: "e2-small" },
        ],
      },
    ],
    plannedAt: new Date("2026-07-08T09:00:00.000Z"),
    summary:
      "バックボーンVM（Mongo 同居）を e2-standard-2 → e2-small に縮小＝メモリ 8→2GB。Mongo のワーキングセットが溢れ接続を捌けず枯渇リスク（コスト最適化・plan済み未適用）",
  },
  {
    resourceChanges: [
      {
        address: FORECAST_VALKEY_PLAN_ADDRESS,
        action: "update",
        attributeDeltas: [
          { key: "memory_size_gb", before: "4", after: "2" },
        ],
      },
    ],
    // plannedAt は flagship（09:00）より古くする＝store は新しい順で返すため flagship が plan-1、
    // 合成 Valkey plan が plan-2 になる（id はこの順序で連番＝stub / E2E の plan-2 期待に一致）。
    plannedAt: new Date("2026-07-08T08:00:00.000Z"),
    summary:
      "カタログキャッシュ（Valkey）の maxmemory を 4GB → 2GB に縮小＝eviction 増でヒット率低下、キャッシュミスが DB を直撃し接続プール枯渇に伝播するリスク（合成 seed・plan済み未適用）",
  },
];

/**
 * seed（fixture）に「証拠を開く」deep link を後付けする（純粋関数・seed 本体は不変に保つ）。
 * `urlByAddress` は plan 先頭リソースの address → 実 PR URL の対応表。現状は flagship（#83）のみ
 * （Valkey は terraform 単独リソースを持たず本物の plan を作れないため非リンク）。address→URL の
 * 対応で線引きするのは、将来 terraform 化された別 plan を個別に紐づけられるようにするため。
 * DEMO_INFRA_APPLY_PR_URL（scenario3/3b の適用済み証拠 PR）と同じ「事前起票した本物を毎回指す」割り切り。
 *
 * ★捏造ガード: 対応表に**その address のエントリがあり、かつ url が非空**の plan にだけ付ける。
 * 未対応 address／空文字の plan には付けない（非リンク表示のまま＝正直な扱い）。
 * 既に url を持つ plan（CI ingest 由来）は上書きしない。
 */
export function withPendingPlanEvidenceUrls(
  plans: PendingPlan[],
  urlByAddress: Record<string, string>,
): PendingPlan[] {
  return plans.map((plan) => {
    if (plan.url) return plan;
    const address = plan.resourceChanges[0]?.address ?? "";
    const url = urlByAddress[address];
    return url ? { ...plan, url } : plan;
  });
}

import { EcDemoGateway, InventoryMode, PaymentMode } from "./EcDemoGateway.js";
import {
  AppliedInfraChange,
  AppliedInfraChangeStore,
} from "../../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/AppliedInfraChangeStore.js";
import { CollectMonitoringEventUseCase } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventUseCase.js";
import {
  SecurityScanBody,
  SecurityScanTranslator,
} from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/SecurityScanTranslator.js";
import { CloudMonitoringAlertTranslator } from "../../../../../Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CloudMonitoringAlertTranslator.js";
import { MonitoringEvent } from "../../../../../Contexts/Monitoring/Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../../../../../Contexts/Monitoring/Shared/domain/MonitoringEventCategory.js";
import { AlertSeverity } from "../../../../../Contexts/Monitoring/Shared/domain/AlertSeverity.js";

export class UnsupportedScenarioError extends Error {
  constructor(scenarioId: string) {
    super(`Unsupported demo scenario: ${scenarioId}`);
  }
}

type ScenarioRecipe = {
  readonly label: string;
  readonly paymentMode: PaymentMode;
  readonly inventoryMode: InventoryMode;
};

// 各シナリオが payment/inventory の両モードを明示設定するので、直前の状態に依存せず独立に再現できる。
const RECIPES: Record<string, ScenarioRecipe> = {
  "payment-timeout": { label: "決済タイムアウト", paymentMode: "TIMEOUT", inventoryMode: "SUCCESS" },
  "inventory-insufficient": { label: "在庫不足", paymentMode: "SUCCESS", inventoryMode: "INSUFFICIENT_STOCK" },
  "inventory-conflict": { label: "在庫競合", paymentMode: "SUCCESS", inventoryMode: "CONCURRENT_CONFLICT" },
};

// 数字エイリアス（UIのシナリオ1/2/3/4/5）も受ける。
// app 枠は 1=完全一致(既知) / 2=類似(準・既知) / 3=未知 の3段スペクトルにする。
const ALIASES: Record<string, string> = {
  "1": "payment-timeout",
  "2": "similar-known",
  "3": "inventory-conflict",
  "4": "infra-fault",
  "5": "security-vuln",
  "6": "infra-config-change",
  "7": "appcode-regression",
};

// infra-fault は他シナリオと違い「注文の業務失敗」ではなくインフラ級異常の注入なので、
// payment/inventory のモード設定も注文投入も伴わない（EcDemoGateway.injectInfraFault のみ）。
const INFRA_FAULT_SCENARIO_ID = "infra-fault";

// security-vuln は EC 操作でも IaC でもなく「CI(Trivy)の検知」を合成する。実機では ci.yml の
// security-scan ジョブが /ingest/security-scan に POST する流れを、デモは正規ペイロードを
// SecurityScanTranslator→CollectMonitoringEventUseCase に直接通すことで即時・確実に再現する
// （= 偽ボタンではなく、実在 ingest 経路と同じ変換・分類を辿る合成注入）。
const SECURITY_VULN_SCENARIO_ID = "security-vuln";

// Trivy が pnpm-lock 上の実在依存から HIGH/CRITICAL を「どばっと」吐いた体の正規化済みボディ。
// 代表（最深刻）CVE をトップに昇格し、全件を vulnerabilities[] に同梱（AI 一括リメディが参照する）
// ＝ ci.yml の jq 整形と同じ形。CRITICAL なので下流 isAlertable()=true で調査に乗る。
function buildSecurityScanBody(): SecurityScanBody {
  const vulnerabilities = [
    {
      cveId: "CVE-2021-3807",
      severity: "CRITICAL",
      package: "ansi-regex",
      version: "3.0.0",
      fixedVersion: "5.0.1",
    },
    {
      cveId: "CVE-2022-25883",
      severity: "HIGH",
      package: "semver",
      version: "7.3.4",
      fixedVersion: "7.5.2",
    },
  ];
  const top = vulnerabilities[0];
  return {
    cveId: top.cveId,
    severity: top.severity,
    package: top.package,
    version: top.version,
    fixedVersion: top.fixedVersion,
    scanner: "trivy",
    target: "repo:fs",
    repo: "ec-monitoring-agent",
    vulnerabilities,
  };
}

// infra-config-change は「IaC 変更（terraform apply）そのものが原因の障害」を、検知の入口だけ
// 合成して実 ingest 経路に通すシナリオ。infra-fault（経路B＝GCP の Cloud Monitoring 依存で
// ローカルでは Alert が出ない）と違い、合成 INFRASTRUCTURE イベントを直接
// CloudMonitoringAlertTranslator→CollectMonitoringEventUseCase に通すので**ローカルでも**
// 実 Alert→AI 調査が走り、AI が記録済みの apply 差分を root cause として収集・提示できる。
const INFRA_CONFIG_CHANGE_SCENARIO_ID = "infra-config-change";

// 障害の「直前の IaC 変更」を AI が原因として突き止められるよう、注入と同時に記録する代表的な apply。
// 実機では CI の terraform apply がこの構造化差分を ingest する想定で、デモはそれを合成する。
// Cloud SQL の接続上限縮小＝接続枯渇 → CRITICAL/500（注入される障害）の決定打になる因果。
const INFRA_FAULT_APPLY_LEAD_MINUTES = 3;

function buildInfraFaultApplyEvent(): AppliedInfraChange {
  return {
    // 障害イベントより少し前（証拠収集窓 30 分以内）に適用された体にする。
    appliedAt: new Date(Date.now() - INFRA_FAULT_APPLY_LEAD_MINUTES * 60 * 1000),
    commitSha: "deadbeefcafe1234",
    summary: "Cloud SQL の接続上限を縮小（コスト最適化）— 接続枯渇の起点",
    resourceChanges: [
      {
        address: "google_sql_database_instance.main",
        action: "update",
        attributeDeltas: [
          { key: "settings.tier", before: "db-custom-2-7680", after: "db-f1-micro" },
          { key: "settings.database_flags.max_connections", before: "100", after: "20" },
        ],
      },
    ],
  };
}

// IaC 変更（インスタンスタイプ縮小）適用直後に Cloud SQL が不安定化した、という Cloud Monitoring
// 発火アラートの最小ペイロード。condition は容量語（connection/pool/cpu…）を避けて命名し、
// translator で **INFRASTRUCTURE** に分類させる（INFRASTRUCTURE のときだけ調査が terraform 差分を引く）。
function buildInfraConfigChangeWebhook(): unknown {
  return {
    incident: {
      incident_id: crypto.randomUUID(),
      resource_name: "google_sql_database_instance.main",
      policy_name: "Cloud SQL 可用性",
      condition_name: "Cloud SQL instance unhealthy after configuration change",
      state: "open",
      started_at: Math.floor(Date.now() / 1000),
      severity: "Critical",
      summary: "IaC 変更（インスタンスタイプ縮小）適用直後に DB インスタンスが不安定化",
      resource: { type: "cloudsql_database", labels: { instance_id: "main" } },
    },
  };
}

// appcode-regression は「テストは通過したアプリコード変更そのものが挙動を退行させた障害」。
// 検知の入口だけ合成（APPLICATION の MonitoringEvent を直接 ingest 経路に通す）し、原因の実コード差分は
// demo/regression ブランチに静的に積んだ実コミットに置く（AI が getCommitDiff で本物を引いて分析する）。
// 4（経路B=GCP依存）と違いローカルでも実 Alert→AI 調査が走る。5/6 と同じ「正直な合成」。
const APPCODE_REGRESSION_SCENARIO_ID = "appcode-regression";

// 症状（WHAT）は Alert が運ぶ。原因（WHY）は demo ブランチの実コミット差分が運ぶ＝AI が両者を相関する。
// source は調査の fetch_app_logs が引く対象サービス名（ec-backend）。occurredOn は now（証跡コミットは
// ref 固定で壁時計非依存に発見されるので時刻整合は不要）。
//
// 【UNKNOWN に確実に倒す設計】eventName/payload は seed のインシデント（類似コーパス）と語彙を被らせない。
//  - 唯一共有する "ec" は全 doc に出る低IDF語で BM25 寄与がほぼゼロ＝類似検索が誤って既知に寄せない。
//  - payload に**日本語プローズを入れない**: kuromoji 無しの既定アナライザは和文を文字単位に割り、seed の
//    和文 resolvedNote と大量に偶発一致して BM25 が飽和し confidence 100% の偽 KNOWN を生む（実害バグ）。
//    短い英語の構造化フィールドのみにする。eventName も seed と被らない pricing 名前空間にする。
function buildAppcodeRegressionEvent(): MonitoringEvent {
  return new MonitoringEvent({
    eventId: crypto.randomUUID(),
    eventName: "ec.pricing.subtotal_mismatch",
    aggregateId: crypto.randomUUID(),
    occurredOn: new Date(),
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.critical(),
    source: "ec-backend",
    payload: {
      symptom: "subtotal rounding mismatch on fractional-priced items",
      httpStatus: 500,
    },
  });
}

// similar-known は「既知パターンには完全一致しないが、過去の解決済み事例に高類似（準・既知）」を
// 見せるシナリオ。DB コネクションプール枯渇の合成 APPLICATION イベントを実 ingest 経路に通す。
// reset が seed する解決済み事例（ResolvedIncidentSeed / ec.db.connection_pool_exhausted）と
// 字句類似 0.667 で一致するため、KnownPatternRule は棄権し SimilarPatternRule が
// source=SIMILARITY・confidence≈0.67 の graded 分類を返す（AI 調査ではなく即・確度付き確定）。
const SIMILAR_KNOWN_SCENARIO_ID = "similar-known";

// eventName/payload は seed 事例と語彙を「意図的に被らせる」（appcode-regression の逆）。
// 既知パターン（payment.timeout / reservation_failed）とは eventName が異なるので完全一致しない。
// severity は類似一致では断定できないため SimilarPatternRule の既定（WARNING）に合わせる。
function buildSimilarKnownEvent(): MonitoringEvent {
  return new MonitoringEvent({
    eventId: crypto.randomUUID(),
    eventName: "ec.db.connection_pool_exhausted",
    aggregateId: crypto.randomUUID(),
    occurredOn: new Date(),
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.warning(),
    source: "ec-backend",
    payload: {
      symptom: "database connection pool exhausted",
    },
  });
}

// 障害シナリオを EC 操作の合成で再現する facade。
// EC の demo モードを設定 → 注文を投入 → EC が障害イベントを発火 → Monitoring が Alert 化（SSE配信）。
export class TriggerDemoScenarioUseCase {
  constructor(
    private readonly ecDemoGateway: EcDemoGateway,
    private readonly productId: string,
    private readonly appliedInfraChangeStore: AppliedInfraChangeStore,
    private readonly collectMonitoringEventUseCase: CollectMonitoringEventUseCase,
  ) {}

  async run(scenarioId: string): Promise<{ scenarioId: string; label: string; orderId: string }> {
    const resolvedId = ALIASES[scenarioId] ?? scenarioId;

    if (resolvedId === SECURITY_VULN_SCENARIO_ID) {
      // 実在 ingest と同じ変換・分類・調査経路を辿る（コントローラの薄い境界をスキップするだけ）。
      const event = SecurityScanTranslator.toMonitoringEvent(buildSecurityScanBody());
      await this.collectMonitoringEventUseCase.run(event);
      // 注文を伴わない検知なので orderId は空。
      return { scenarioId: resolvedId, label: "脆弱性検知", orderId: "" };
    }

    if (resolvedId === INFRA_FAULT_SCENARIO_ID) {
      // 注入の前に apply イベントを記録しておく（調査時に「直前の変更」として時間窓で引ける）。
      await this.appliedInfraChangeStore.record(buildInfraFaultApplyEvent());
      await this.ecDemoGateway.injectInfraFault();
      // 注文を伴わないので orderId は空。Cloud Monitoring 経由で Alert 化されるため即時の orderId 相関は無い。
      return { scenarioId: resolvedId, label: "インフラ障害", orderId: "" };
    }

    if (resolvedId === INFRA_CONFIG_CHANGE_SCENARIO_ID) {
      // ① 直前の IaC 変更（apply 差分）を記録 → ② その変更が原因の INFRASTRUCTURE 障害を合成入力で発火。
      // 入口だけ合成し、変換→分類→AI 調査（terraform 差分を root cause として収集）は実経路を辿る。
      await this.appliedInfraChangeStore.record(buildInfraFaultApplyEvent());
      const event = CloudMonitoringAlertTranslator.toMonitoringEvent(
        buildInfraConfigChangeWebhook(),
      );
      await this.collectMonitoringEventUseCase.run(event);
      // 注文を伴わない検知なので orderId は空。
      return { scenarioId: resolvedId, label: "構成変更障害", orderId: "" };
    }

    if (resolvedId === SIMILAR_KNOWN_SCENARIO_ID) {
      // 入口だけ合成: APPLICATION の障害を実 ingest 経路に通す。既知パターンには一致せず、
      // reset が seed した解決済み事例と字句類似で一致 → SimilarPatternRule が準・既知に分類。
      await this.collectMonitoringEventUseCase.run(buildSimilarKnownEvent());
      // 注文を伴わない検知なので orderId は空。
      return { scenarioId: resolvedId, label: "DBコネクションプール枯渇", orderId: "" };
    }

    if (resolvedId === APPCODE_REGRESSION_SCENARIO_ID) {
      // 入口だけ合成: APPLICATION の障害を直接 ingest 経路に通す。原因の実コード差分は
      // demo/regression ブランチ（GITHUB_TARGET_REF）の実コミットにあり、AI が調査時に引く。
      await this.collectMonitoringEventUseCase.run(buildAppcodeRegressionEvent());
      // 注文を伴わない検知なので orderId は空。
      return { scenarioId: resolvedId, label: "アプリコード退行", orderId: "" };
    }

    const recipe = RECIPES[resolvedId];
    if (!recipe) {
      throw new UnsupportedScenarioError(scenarioId);
    }

    await this.ecDemoGateway.setPaymentMode(recipe.paymentMode);
    await this.ecDemoGateway.setInventoryMode(recipe.inventoryMode);

    // EC の CustomerId/OrderId は UUID 必須。orderId はクライアント側で確定し、
    // 障害で EC が非2xx を返しても相関できるようにする。
    const { orderId } = await this.ecDemoGateway.placeOrder({
      orderId: crypto.randomUUID(),
      customerId: crypto.randomUUID(),
      items: [{ productId: this.productId, quantity: 1, unitPrice: 1000 }],
    });

    return { scenarioId: resolvedId, label: recipe.label, orderId };
  }
}

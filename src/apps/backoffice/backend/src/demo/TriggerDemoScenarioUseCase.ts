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

// 数字エイリアス（UIのシナリオ1/2/3/4/5）も受ける
const ALIASES: Record<string, string> = {
  "1": "payment-timeout",
  "2": "inventory-insufficient",
  "3": "inventory-conflict",
  "4": "infra-fault",
  "5": "security-vuln",
  "6": "infra-config-change",
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

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

// 2026-07-06 シナリオ絞り込み: 旧5（構成変更障害）・旧6（アプリコード退行）はデモ卓から撤退した。
// 検知の入口の説得力（「実際はどう検知するのか」）が弱く、発表の尺でも 1/2/3/3b/4 に絞る方が
// 確度スペクトル（既知→類似→未知）と realness 3階級（実トリガ/クラウド実検知/合成）を過不足なく語れるため。
// 実装は git 履歴（f9f432c 以前）に残っており、必要になれば復活できる。

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
};

// 数字エイリアス（UIのシナリオ1/2/3/4…）も受ける。
// app 枠は 1=完全一致(既知) / 2=類似(準・既知) / 3以降=未知 のスペクトルにする。
// 3b は 3（実 Cloud Monitoring 経路）の合成注入版＝デモ反復用（後述）。
const ALIASES: Record<string, string> = {
  "1": "payment-timeout",
  "2": "similar-known",
  "3": "infra-fault",
  "3b": "infra-fault-synthetic",
  "4": "security-vuln",
};

// infra-fault は他シナリオと違い「注文の業務失敗」ではなくインフラ級異常の注入なので、
// payment/inventory のモード設定も注文投入も伴わない（EcDemoGateway.injectInfraFault のみ）。
const INFRA_FAULT_SCENARIO_ID = "infra-fault";

// infra-fault-synthetic は 3（infra-fault）の「デモ反復用」合成版。
// 3 は実 CRITICAL ログ→実 Cloud Monitoring 発報（経路B）で真正だが、インシデントが GCP 側に開いたまま
// 残り（閉じる公開 API が無い）、開いている間は再発火しても新規 webhook が飛ばず started_at も古いまま。
// そこで scenario 4 と同じ「入口だけ合成」で、実 CM が送るのと同型の webhook を
// CloudMonitoringAlertTranslator→CollectMonitoringEventUseCase に直接通す。
// → started_at=now の新鮮な Alert が即・確実に立ち、GCP 側にインシデントを残さないのでデモ reset で完全に消える。
//   eventName/category/severity は 3 と同一（condition_name を実ポリシーと合わせる）ため下流は完全に同じ経路。
const INFRA_FAULT_SYNTHETIC_SCENARIO_ID = "infra-fault-synthetic";

// 実ポリシー「アプリ CRITICAL ログ検知」の condition（display_name="CRITICAL log entries"）が発火した体の
// 最小 webhook。translator は eventName=gcp.monitoring.critical_log_entries（slugify 一致）・
// INFRASTRUCTURE・Critical を導く＝実 CM 発報（scenario 3）と同一の dedupKey/分類になる。
function buildInfraFaultSyntheticWebhook(): unknown {
  return {
    incident: {
      incident_id: crypto.randomUUID(),
      resource_name: "ec-monitoring-backbone",
      policy_name: "アプリ CRITICAL ログ検知",
      condition_name: "CRITICAL log entries",
      state: "open",
      started_at: Math.floor(Date.now() / 1000),
      severity: "Critical",
      summary:
        "デモ用インフラ障害（合成注入・実 Cloud Monitoring 経路と同一変換）: CRITICAL ログ + HTTP 500 相当",
      resource: { type: "gce_instance", labels: { instance_id: "ec-monitoring-backbone" } },
    },
  };
}

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

// 障害の「直前の IaC 変更」を AI が原因として突き止められるよう、注入と同時に記録する代表的な apply。
// 実機では CI の terraform apply がこの構造化差分を ingest する想定で、デモはそれを合成する。
// Cloud SQL の接続上限縮小＝接続枯渇 → CRITICAL/500（注入される障害）の決定打になる因果。
const INFRA_FAULT_APPLY_LEAD_MINUTES = 3;

// prUrl は事前に手動起票した「同内容の本物 PR」の URL（config.demo.infraApplyPrUrl・任意）。
// commitSha は合成のダミーで実リポジトリに存在しないため、リンクは sha からは組み立てず
// 実在 PR の URL をそのまま添える（リンク先 404 を作らない）。空なら従来通り非リンク表示。
function buildInfraFaultApplyEvent(prUrl: string): AppliedInfraChange {
  return {
    // 障害イベントより少し前（証拠収集窓 30 分以内）に適用された体にする。
    appliedAt: new Date(Date.now() - INFRA_FAULT_APPLY_LEAD_MINUTES * 60 * 1000),
    commitSha: "deadbeefcafe1234",
    ...(prUrl !== "" ? { url: prUrl } : {}),
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
    // 構成変更シナリオの apply 差分に添える実在 PR の URL（空＝リンクなし）。
    private readonly infraApplyPrUrl: string = "",
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
      await this.appliedInfraChangeStore.record(buildInfraFaultApplyEvent(this.infraApplyPrUrl));
      await this.ecDemoGateway.injectInfraFault();
      // 注文を伴わないので orderId は空。Cloud Monitoring 経由で Alert 化されるため即時の orderId 相関は無い。
      return { scenarioId: resolvedId, label: "インフラ障害", orderId: "" };
    }

    if (resolvedId === INFRA_FAULT_SYNTHETIC_SCENARIO_ID) {
      // 3 と同じ根本原因証跡（直前の Cloud SQL apply）を記録してから、実 CM が送るのと同型の
      // CRITICAL ログ発報 webhook を合成入力で流す。GCP 側にインシデントを残さず即・新鮮に再現する。
      await this.appliedInfraChangeStore.record(buildInfraFaultApplyEvent(this.infraApplyPrUrl));
      const event = CloudMonitoringAlertTranslator.toMonitoringEvent(
        buildInfraFaultSyntheticWebhook(),
      );
      await this.collectMonitoringEventUseCase.run(event);
      // 注文を伴わない検知なので orderId は空。
      return { scenarioId: resolvedId, label: "インフラ障害（合成・反復用）", orderId: "" };
    }

    if (resolvedId === SIMILAR_KNOWN_SCENARIO_ID) {
      // 入口だけ合成: APPLICATION の障害を実 ingest 経路に通す。既知パターンには一致せず、
      // reset が seed した解決済み事例と字句類似で一致 → SimilarPatternRule が準・既知に分類。
      await this.collectMonitoringEventUseCase.run(buildSimilarKnownEvent());
      // 注文を伴わない検知なので orderId は空。
      return { scenarioId: resolvedId, label: "DBコネクションプール枯渇", orderId: "" };
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

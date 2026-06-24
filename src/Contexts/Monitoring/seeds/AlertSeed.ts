import { Alert } from "../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../AlertAnalysis/domain/AlertId.js";
import { ClassificationConfidence } from "../AlertAnalysis/domain/AlertClassification.js";
import { ClassificationRuleKind } from "../AlertAnalysis/domain/classification/ClassificationRuleKind.js";
import { InvestigationReport } from "../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity } from "../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../Shared/domain/MonitoringEventCategory.js";

const now = new Date("2026-06-22T09:00:00.000Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60 * 1000);

export const ALERT_SEEDS: Alert[] = [
  Alert.createFromKnownPattern({
    id: new AlertId("5eeda1e7-0001-4000-8000-000000000001"),
    monitoringEvent: new MonitoringEvent({
      eventId: "seed-event-0001-0000-0000-000000000001",
      eventName: "ec.payment.timeout",
      aggregateId: "order-seed-0001",
      occurredOn: ago(30),
      payload: { orderId: "order-seed-0001", timeoutMs: 30000 },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.critical(),
      source: "ec-backend",
    }),
    classification: {
      type: "known",
      source: ClassificationRuleKind.EXACT_MATCH,
      patternId: "a1b2c3d4-1234-4a5b-89ab-c1d2e3f4a5b6",
      patternName: "PAYMENT_TIMEOUT",
      severity: AlertSeverity.critical(),
      confidence: ClassificationConfidence.certain(),
      matchedConditions: [],
      unmatchedConditions: [],
    },
  }).attachInvestigationReport(
    new InvestigationReport({
      summary: "決済サービスへの接続が30秒でタイムアウトしました。外部決済APIのレスポンス遅延が原因と推定されます。",
      confidence: 0.95,
      severity: AlertSeverity.critical(),
      // 構造化（href/kind）で配信し、調査ステップ／アクションから外部サービスへ直接飛べる動線を見せる。
      investigationSteps: [
        {
          text: "外部決済サービスのステータスページを確認",
          href: "https://status.stripe.com/",
          kind: "runbook",
        },
        {
          text: "過去1時間のタイムアウト発生頻度を Cloud Logging で集計",
          href: "https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_revision%22%20textPayload%3D~%22payment.timeout%22",
          kind: "log",
        },
        {
          text: "決済クライアントのタイムアウト設定を確認",
          href: "https://github.com/example-org/ec-backend/blob/main/src/payment/PaymentClient.ts",
          kind: "code",
        },
      ],
      suggestedActions: [
        "決済サービスのステータスを確認し、タイムアウトした注文を手動で再処理してください。",
        {
          text: "タイムアウト閾値の調整／リトライ追加（修正方針の PR を確認）",
          href: "https://github.com/example-org/ec-backend/pull/482",
          kind: "code",
        },
      ],
      suggestedPatternName: "PAYMENT_TIMEOUT",
      reviewStatus: ReviewStatus.pendingReview(),
      investigatedAt: ago(28),
      isFallback: false,
    }),
  ),

  Alert.createFromKnownPattern({
    id: new AlertId("5eeda1e7-0002-4000-8000-000000000002"),
    monitoringEvent: new MonitoringEvent({
      eventId: "seed-event-0002-0000-0000-000000000002",
      eventName: "ec.inventory.reservation_failed",
      aggregateId: "product-seed-0042",
      occurredOn: ago(15),
      payload: { productId: "product-seed-0042", reason: "INSUFFICIENT_STOCK", requestedQty: 5, availableQty: 2 },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.warning(),
      source: "ec-backend",
    }),
    classification: {
      type: "known",
      source: ClassificationRuleKind.EXACT_MATCH,
      patternId: "b2c3d4e5-2345-4b6c-9bcd-d2e3f4a5b6c7",
      patternName: "INVENTORY_INSUFFICIENT",
      severity: AlertSeverity.warning(),
      confidence: ClassificationConfidence.certain(),
      matchedConditions: [{ field: "reason", expectedValue: "INSUFFICIENT_STOCK", actualValue: "INSUFFICIENT_STOCK" }],
      unmatchedConditions: [],
    },
  }).attachInvestigationReport(
    new InvestigationReport({
      summary: "商品 product-seed-0042 の在庫が不足しています。要求数5に対して在庫残2です。",
      confidence: 0.92,
      severity: AlertSeverity.warning(),
      investigationSteps: [
        "対象商品の在庫数を確認",
        "直近の入荷スケジュールを確認",
        "同商品への注文件数トレンドを確認",
      ],
      suggestedActions: [
        "在庫を補充するか、該当商品を販売停止にしてください。",
      ],
      suggestedPatternName: "INVENTORY_INSUFFICIENT",
      reviewStatus: ReviewStatus.pendingReview(),
      investigatedAt: ago(13),
      isFallback: false,
    }),
  ),

  Alert.createFromKnownPattern({
    id: new AlertId("5eeda1e7-0003-4000-8000-000000000003"),
    monitoringEvent: new MonitoringEvent({
      eventId: "seed-event-0003-0000-0000-000000000003",
      eventName: "ec.inventory.reservation_failed",
      aggregateId: "product-seed-0099",
      occurredOn: ago(5),
      payload: { productId: "product-seed-0099", reason: "CONCURRENT_CONFLICT", retryCount: 3 },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.warning(),
      source: "ec-backend",
    }),
    classification: {
      type: "known",
      source: ClassificationRuleKind.SIMILARITY,
      patternId: "c3d4e5f6-3456-4c7d-abce-e3f4a5b6c7d8",
      patternName: "INVENTORY_CONCURRENT_CONFLICT",
      severity: AlertSeverity.warning(),
      confidence: ClassificationConfidence.of(0.87),
      matchedConditions: [{ field: "reason", expectedValue: "CONCURRENT_CONFLICT", actualValue: "CONCURRENT_CONFLICT" }],
      unmatchedConditions: [],
      // 類似既知（SIMILARITY）の back-link。過去の同型在庫障害（...0002）へ内部遷移できる動線を見せる。
      sourceAlertId: "5eeda1e7-0002-4000-8000-000000000002",
    },
  }).attachInvestigationReport(
    new InvestigationReport({
      summary: "商品 product-seed-0099 の在庫予約で同時アクセスによる競合が3回連続発生しました。",
      confidence: 0.88,
      severity: AlertSeverity.warning(),
      investigationSteps: [
        "在庫予約処理の同時リクエスト数を確認",
        "楽観的ロックの競合頻度ログを確認",
      ],
      suggestedActions: [
        "リトライロジックを確認し、必要であれば在庫予約の競合対策を見直してください。",
      ],
      suggestedPatternName: "INVENTORY_CONCURRENT_CONFLICT",
      reviewStatus: ReviewStatus.pendingReview(),
      investigatedAt: ago(3),
      isFallback: false,
    }),
  ),

  Alert.createAsUnknown({
    id: new AlertId("5eeda1e7-0004-4000-8000-000000000004"),
    monitoringEvent: new MonitoringEvent({
      eventId: "seed-event-0004-0000-0000-000000000004",
      eventName: "ec.order.processing_failed",
      aggregateId: "order-seed-0099",
      occurredOn: ago(2),
      payload: { orderId: "order-seed-0099", errorCode: "UNKNOWN_GATEWAY_ERROR" },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.pending(),
      source: "ec-backend",
    }),
  }),
];

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
  // ── Alert 0001: 決済タイムアウト（他責ルート）─────────────────────────────
  // タスク34: impact.fault="external" で影響評価を表示（障害規模・引用付き）
  // タスク35: fault=external → RunbookEscalationAgent → escalation 草案を表示
  // タスク37: 詳細（variant="full"）でのみ impact 全項目＋escalation が出る
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
      source: "payment",
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
      summary:
        "決済サービスへの接続が30秒でタイムアウトしました。外部決済APIのレスポンス遅延が原因と推定されます。",
      confidence: 0.95,
      severity: AlertSeverity.critical(),
      remediable: false,
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
      relatedAlerts: [
        {
          alertId: "5eeda1e7-0004-4000-8000-000000000004",
          relation: "downstream",
          rationale:
            "決済タイムアウトの結果、注文処理が UNKNOWN_GATEWAY_ERROR で連鎖失敗。同一の決済ゲートウェイ障害が根本原因。",
        },
      ],
      // タスク34: 影響評価（外部決済 API 障害）
      impact: {
        fault: "external",
        scope: "全決済・チェックアウトフロー（payment / checkout サービス）",
        scale: "過去30分で約47件の注文が決済未処理。障害は継続中の可能性あり",
        affectedSubjects: ["payment", "checkout", "external-api"],
        citations: [
          "log:payment-timeout-cluster-20260622T085943Z",
          "similar:incident-stripe-outage-20260301",
        ],
      },
      // タスク35: 他責ルート → external-vendor-liaison へエスカレーション草案
      escalation: {
        team: "external-vendor-liaison",
        owner: "外部ベンダー窓口",
        contact: "#vendor-liaison (Slack) / vendor-liaison@example.com",
        reason:
          "Stripe 外部決済 API の障害が根本原因。直近コミット・Terraform 差分との相関なし。自社コードではなくベンダー対応が必要",
        interimWorkaround:
          "決済処理をキューに積み Stripe 復旧後に再処理する。復旧まで注文確定を保留するか、銀行振込に案内する",
        severityRationale:
          "過去30分で47件の決済失敗・継続中のリアルタイム障害。P1-15m SLA 相当",
        evidenceBundle: [
          "log:payment-timeout-cluster-20260622T085943Z",
          "similar:incident-stripe-outage-20260301",
        ],
      },
    }),
  ),

  // ── Alert 0002: 在庫不足（自責ルート・PR レビュー通過）──────────────────
  // タスク34: impact.fault="own" で自社コードの問題として影響評価を表示
  // タスク36: remediationReview.verdict="pass" → 修正 PR が根本原因に対応済み
  // タスク37: 詳細（variant="full"）でのみ impact + remediationReview が出る
  Alert.createFromKnownPattern({
    id: new AlertId("5eeda1e7-0002-4000-8000-000000000002"),
    monitoringEvent: new MonitoringEvent({
      eventId: "seed-event-0002-0000-0000-000000000002",
      eventName: "ec.inventory.reservation_failed",
      aggregateId: "product-seed-0042",
      occurredOn: ago(15),
      payload: {
        productId: "product-seed-0042",
        reason: "INSUFFICIENT_STOCK",
        requestedQty: 5,
        availableQty: 2,
      },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.warning(),
      source: "inventory",
      discriminator: "INSUFFICIENT_STOCK",
    }),
    classification: {
      type: "known",
      source: ClassificationRuleKind.EXACT_MATCH,
      patternId: "b2c3d4e5-2345-4b6c-9bcd-d2e3f4a5b6c7",
      patternName: "INVENTORY_INSUFFICIENT",
      severity: AlertSeverity.warning(),
      confidence: ClassificationConfidence.certain(),
      matchedConditions: [
        {
          field: "reason",
          expectedValue: "INSUFFICIENT_STOCK",
          actualValue: "INSUFFICIENT_STOCK",
        },
      ],
      unmatchedConditions: [],
    },
  }).attachInvestigationReport(
    new InvestigationReport({
      summary:
        "商品 product-seed-0042 の在庫が不足しています。要求数5に対して在庫残2です。",
      confidence: 0.92,
      severity: AlertSeverity.warning(),
      // 自動修正（payload.vulnerabilities 起点）の対象ではない＝起票しても skip になるため false。
      // 修正は人間の PR（remediationReview=pass）で表現する（「直せる」と煽らない）。
      remediable: false,
      investigationSteps: [
        "対象商品の在庫数を確認",
        "直近の入荷スケジュールを確認",
        "同商品への注文件数トレンドを確認",
      ],
      suggestedActions: [
        "在庫を補充するか、該当商品を販売停止にしてください。",
        {
          text: "発注点（reorder threshold）の調整 PR",
          href: "https://github.com/example-org/ec-backend/pull/501",
          kind: "code",
        },
      ],
      suggestedPatternName: "INVENTORY_INSUFFICIENT",
      reviewStatus: ReviewStatus.pendingReview(),
      investigatedAt: ago(13),
      isFallback: false,
      // タスク34: 影響評価（自社在庫管理ロジックの問題）
      impact: {
        fault: "own",
        scope: "在庫管理・商品予約フロー（inventory / fulfillment サービス）",
        scale: "product-seed-0042 の在庫残2件。直近1時間で5件の予約失敗",
        affectedSubjects: ["inventory", "fulfillment"],
        citations: [
          "log:inventory-reservation-20260622T084500Z",
          "commit:fix/reorder-threshold-a3f9b2c",
        ],
      },
      // タスク36: 修正 PR レビュー通過（根本原因に対応・テストカバレッジ確認済み）
      remediationReview: {
        verdict: "pass",
        concerns: [],
        pullRequestUrl: "https://github.com/example-org/ec-backend/pull/501",
        citations: [
          "diff:src/inventory/ReorderPolicy.ts#L34-L52",
          "test:ReorderPolicy.test.ts#L88",
          "ci:check-run-8821/passed",
        ],
      },
    }),
  ),

  // ── Alert 0004: 注文処理失敗（自責ルート・PR レビュー懸念あり）────────────
  // タスク34: impact.fault="own" で自社の決済連携コードの問題として影響評価を表示
  // タスク36: remediationReview.verdict="concerns" → 修正 PR に懸念点あり（人間確認を促す）
  // タスク37: 詳細（variant="full"）でのみ impact + remediationReview の concerns が出る
  Alert.createAsUnknown({
    id: new AlertId("5eeda1e7-0004-4000-8000-000000000004"),
    monitoringEvent: new MonitoringEvent({
      eventId: "seed-event-0004-0000-0000-000000000004",
      eventName: "ec.order.processing_failed",
      aggregateId: "order-seed-0099",
      occurredOn: ago(2),
      payload: {
        orderId: "order-seed-0099",
        errorCode: "UNKNOWN_GATEWAY_ERROR",
      },
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.pending(),
      source: "order",
    }),
  }).attachInvestigationReport(
    new InvestigationReport({
      summary:
        "注文処理が UNKNOWN_GATEWAY_ERROR で失敗しました。直前の決済タイムアウト（同一の決済ゲートウェイ障害）が連鎖した結果と推定されます。",
      confidence: 0.82,
      severity: AlertSeverity.critical(),
      // 自動修正（payload.vulnerabilities 起点）の対象ではない＝起票しても skip になるため false。
      // 修正は人間の PR（remediationReview=concerns で要確認）で表現する。
      remediable: false,
      investigationSteps: [
        "同時刻帯の決済タイムアウト発生有無を確認",
        "決済ゲートウェイのエラーレスポンスを Cloud Logging で照会",
      ],
      suggestedActions: [
        "決済ゲートウェイの復旧を確認し、失敗した注文を再処理してください。",
        {
          text: "ゲートウェイエラーハンドリング改善 PR（要確認）",
          href: "https://github.com/example-org/ec-backend/pull/503",
          kind: "code",
        },
      ],
      suggestedPatternName: "ORDER_GATEWAY_FAILURE（推定）",
      reviewStatus: ReviewStatus.pendingReview(),
      investigatedAt: ago(1),
      isFallback: false,
      relatedAlerts: [
        {
          alertId: "5eeda1e7-0001-4000-8000-000000000001",
          relation: "upstream",
          rationale:
            "決済タイムアウトが先行し、その結果この注文処理が連鎖失敗。同一の決済ゲートウェイ障害が根本原因。",
        },
      ],
      // タスク34: 影響評価（自社の決済連携コードの問題）
      impact: {
        fault: "own",
        scope: "注文処理・決済連携フロー（order / payment サービス）",
        scale:
          "直近2分で1件の注文処理失敗。決済タイムアウト波及でさらに拡大の可能性",
        affectedSubjects: ["order", "payment"],
        citations: [
          "log:order-processing-failed-20260622T085800Z",
          "log:payment-timeout-cluster-20260622T085943Z",
        ],
      },
      // タスク36: 修正 PR レビュー懸念あり（タイムアウトリトライロジックの欠如・テスト不足）
      remediationReview: {
        verdict: "concerns",
        concerns: [
          "修正が GATEWAY_ERROR のハンドリングに限定されており、根本原因の決済タイムアウトリトライロジックへの対応が含まれていない",
          "テストケースにタイムアウトシナリオのカバレッジがない（OrderProcessor.test.ts#L112 以降未追加）",
        ],
        pullRequestUrl: "https://github.com/example-org/ec-backend/pull/503",
        citations: [
          "diff:src/order/OrderProcessor.ts#L112-L125",
          "test:OrderProcessor.test.ts",
          "log:payment-timeout-cluster-20260622T085943Z",
        ],
      },
    }),
  ),

  // ── Alert 0005: 断続的レイテンシ急増（未知・AI が確証を持てない正直ルート）─────────
  // confidence 較正のショーケース。証拠が薄く競合仮説が残るため AI が断定せず低 confidence
  // (0.3=フロントでは rose) を出す。fault="unknown"・suggestedPatternName 空（自動昇格しない）で
  // 「分からないときは正直に低く出す」を表現する。全件が高 confidence のデモは逆に信用を落とすため、
  // 1件この honest な未知ケースを混ぜて他の高 confidence を本物に見せる狙い。
  // Alert.createAsUnknown({
  //   id: new AlertId("5eeda1e7-0005-4000-8000-000000000005"),
  //   monitoringEvent: new MonitoringEvent({
  //     eventId: "seed-event-0005-0000-0000-000000000005",
  //     eventName: "ec.api.latency_spike",
  //     aggregateId: "checkout-seed-0005",
  //     occurredOn: ago(8),
  //     payload: { service: "checkout", p99LatencyMs: 4200, baselineMs: 600 },
  //     category: MonitoringEventCategory.application(),
  //     severity: AlertSeverity.pending(),
  //     source: "checkout",
  //   }),
  // }).attachInvestigationReport(
  //   new InvestigationReport({
  //     summary:
  //       "checkout の p99 レイテンシが断続的に急増していますが、根本原因を特定できませんでした。直近の自社変更・インフラ差分・外部APIの異常はいずれも確認できず、複数の仮説が残っています。",
  //     confidence: 0.3,
  //     severity: AlertSeverity.warning(),
  //     remediable: false,
  //     investigationSteps: [
  //       "直近30分の Cloud Logging を確認 → 明確なエラーログは見つからず（散発的な遅延のみ）",
  //       "直近の commit / terraform 差分を確認 → 障害時刻と相関する変更は無し",
  //       "外部決済・在庫APIのレスポンスタイムを確認 → 異常な遅延は観測されず",
  //       "CPU/メモリ使用率を確認 → 飽和はしておらず、容量起因とは断定できない",
  //     ],
  //     suggestedActions: [
  //       "再現条件が不明なため、まずトレース（分散トレーシング）を有効化して遅延の発生区間を切り分けてください。",
  //       "断続的なため、しきい値を下げて再発時のメトリクス・ログを追加採取し、確証が得られてから対処を判断してください。",
  //     ],
  //     // 確証が無いため自動昇格パターンは出さない（空＝学習・昇格の対象外）。
  //     suggestedPatternName: "",
  //     reviewStatus: ReviewStatus.pendingReview(),
  //     investigatedAt: ago(6),
  //     isFallback: false,
  //     // 証拠不足で自責・他責を断定できない＝fault="unknown"。断定しないことを scope/scale でも明示する。
  //     // unknown でも根拠（何を見て分からなかったか）は citations で示し、ハルシネーションガードを通す。
  //     impact: {
  //       fault: "unknown",
  //       scope: "checkout フローの一部リクエストに断続的な遅延。影響範囲は切り分け中で確定できず",
  //       scale: "p99 が約7倍（600ms→4200ms）に断続的に上昇。発生頻度・継続時間は確定できず",
  //       affectedSubjects: ["checkout"],
  //       citations: [
  //         "log:checkout-latency-intermittent-20260622T085200Z",
  //         "metric:checkout-p99-spike-20260622T085200Z",
  //       ],
  //     },
  //   }),
  // ),
];

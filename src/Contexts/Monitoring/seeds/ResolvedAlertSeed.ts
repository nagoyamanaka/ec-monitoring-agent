import { Alert } from "../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../AlertAnalysis/domain/AlertId.js";
import { InvestigationReport } from "../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity } from "../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../Shared/domain/MonitoringEventCategory.js";
import { SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID } from "./ResolvedIncidentSeed.js";

// 解決済みアーカイブ Alert（RESOLVED）の seed。役割は2系統:
//
// 1. 「類似・準既知」デモ（シナリオ2）で SIMILARITY 分類が back-link する過去の解決済み Alert
//    （buildResolvedPaymentDeclinedAlert）。類似分類の sourceAlertId（= ResolvedIncident.sourceAlertId）
//    から関連アラートとしてクリック→詳細を開けるようにする。無いと「詳細を開く」が空を開く。
// 2. 予兆フラッグシップ（F8・DB接続枯渇）の MEMORY シグナル供給元（DB プール系3本）。
//
// 一覧には出さない: status=RESOLVED は GET /alerts 一覧から除外する（GetAlertReportUseCase）。
// それでも `GET /alerts/:id` では引けるので、関連アラート導線・ディープリンクからは開ける。
// ＝「作らないと関連として見れないが、一覧には出したくない」の解（過去アラートはアーカイブ扱い）。
const SEED_ALERT_ID = SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID;

// DB プール枯渇のアーカイブ（旧シナリオ2の deep-link 先だった事例）。シナリオ2 が
// 決済プロバイダ拒否へ移行した後も、予兆 MEMORY の材料（suggestedPatternName 由来の
// derived subject）として残す。id は歴代 seed と衝突しない固定値。
const DB_POOL_ARCHIVE_ALERT_ID = "5eed0000-0000-4000-8000-000000000001";

// 予兆フラッグシップ（F8・DB接続枯渇）の MEMORY シグナル供給元になる過去インシシデント。
// ForecastMemory は RESOLVED＋レポート付き Alert から投影されるため、report.subject を
// 主シグナル（pending plan / schedule seed）の subject とトークン突合する語彙で明示する。
// 引用（citations）は incident.<この id> → GET /alerts/:id の実在 Alert に解決できる。
export const FORECAST_MEMORY_SEED_ALERT_IDS = {
  // 過去に同じバックボーン VM（Mongo 同居）の縮小で枯渇した事例（pending plan と同 subject）
  poolShrinkRegression: "5eed0000-0000-4000-8000-000000000002",
  // 週末セールの checkout 負荷で接続待ちが急増した事例（schedule seed と同 subject）
  weekendCheckoutPeak: "5eed0000-0000-4000-8000-000000000003",
} as const;

function buildResolvedDbPoolAlert(): Alert {
  const pastEvent = new MonitoringEvent({
    eventId: "5eed0000-0000-4000-8000-0000000000e1",
    eventName: "ec.db.connection_pool_exhausted",
    aggregateId: "5eed0000-0000-4000-8000-0000000000a1",
    occurredOn: new Date("2026-06-15T09:00:00.000Z"),
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.warning(),
    source: "ec-backend",
    payload: { symptom: "database connection pool exhausted" },
  });

  const report = new InvestigationReport({
    summary:
      "DB コネクションプールが枯渇。ピーク時に接続が上限に達し新規取得が待たされていた。プールサイズを引き上げて解消済み。",
    confidence: 0.9,
    severity: AlertSeverity.warning(),
    investigationSteps: [
      "接続数メトリクスを確認（上限到達を確認）",
      "プール設定・アイドル回収を点検",
    ],
    suggestedActions: [
      "接続プールの最大サイズを引き上げる",
      "アイドル接続の回収間隔を短縮する",
    ],
    suggestedPatternName: "DB_CONNECTION_POOL_EXHAUSTION",
    reviewStatus: ReviewStatus.approved(),
    investigatedAt: new Date("2026-06-15T09:20:00.000Z"),
    isFallback: false,
  });

  // 未知として調査→レポート添付（OPEN）まで作り、primitives 経由で RESOLVED（解決済みアーカイブ）に落とす。
  const base = Alert.createAsUnknown({
    id: new AlertId(DB_POOL_ARCHIVE_ALERT_ID),
    monitoringEvent: pastEvent,
  }).attachInvestigationReport(report);

  return Alert.fromPrimitives({
    ...base.toPrimitives(),
    status: "RESOLVED",
    feedback: { isCorrect: true, operatorNote: "プールサイズ引き上げで解消" },
    correctFeedbackCount: 1,
  });
}

// シナリオ2（類似・準既知）の back-link 先: 過去の決済プロバイダ障害（与信拒否）の解決済み事例。
// ResolvedIncidentSeed（similarity コーパス）の sourceAlertId がこの Alert を指す。
// 実トリガ（PaymentMode=DECLINED の実注文）が発火する ec.payment.declined と同型。
function buildResolvedPaymentDeclinedAlert(): Alert {
  const pastEvent = new MonitoringEvent({
    eventId: "5eed0000-0000-4000-8000-0000000000e4",
    eventName: "ec.payment.declined",
    aggregateId: "5eed0000-0000-4000-8000-0000000000a4",
    occurredOn: new Date("2026-06-10T13:00:00.000Z"),
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.warning(),
    source: "payment",
    payload: {
      orderId: "5eed0000-0000-4000-8000-0000000000b4",
      customerId: "5eed0000-0000-4000-8000-0000000000c4",
      amount: 8400,
      reason: "PROVIDER_UNAVAILABLE",
    },
  });

  const report = new InvestigationReport({
    summary:
      "決済プロバイダ側の一時障害により与信リクエストが全件拒否（PROVIDER_UNAVAILABLE）。プロバイダのステータスページで障害を確認し、復旧までセカンダリプロバイダへフェイルオーバーして解消済み。",
    confidence: 0.88,
    severity: AlertSeverity.warning(),
    investigationSteps: [
      "拒否理由コードの分布を確認（全件 PROVIDER_UNAVAILABLE ＝顧客都合でない）",
      "プロバイダのステータスページ・障害情報を確認",
    ],
    suggestedActions: [
      "セカンダリ決済プロバイダへフェイルオーバーする",
      "プロバイダ復旧後に失敗注文の再決済を案内する",
    ],
    suggestedPatternName: "PAYMENT_PROVIDER_OUTAGE",
    reviewStatus: ReviewStatus.approved(),
    investigatedAt: new Date("2026-06-10T13:25:00.000Z"),
    isFallback: false,
  });

  const base = Alert.createAsUnknown({
    id: new AlertId(SEED_ALERT_ID),
    monitoringEvent: pastEvent,
  }).attachInvestigationReport(report);

  return Alert.fromPrimitives({
    ...base.toPrimitives(),
    status: "RESOLVED",
    feedback: {
      isCorrect: true,
      operatorNote: "プロバイダ障害時間帯のみの拒否。フェイルオーバーで解消",
    },
    correctFeedbackCount: 1,
  });
}

// 前回のバックボーン VM 縮小 apply がピーク帯の枯渇を招いた事例。
// subject は terraform リソース address（pending plan seed と同一語彙）＝「同じ VM を
// また縮小しようとしている」未来シグナルと直接突合する（forecastSubject のトークン照合）。
function buildPoolShrinkRegressionAlert(): Alert {
  const pastEvent = new MonitoringEvent({
    eventId: "5eed0000-0000-4000-8000-0000000000e2",
    eventName: "ec.db.connection_pool_exhausted",
    aggregateId: "5eed0000-0000-4000-8000-0000000000a2",
    occurredOn: new Date("2026-05-30T11:30:00.000Z"),
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.critical(),
    source: "ec-backend",
    payload: { symptom: "connection acquisition timeout after backbone VM downsize" },
  });

  const report = new InvestigationReport({
    summary:
      "バックボーン VM（Mongo 同居）の machine_type 縮小適用後、メモリ/接続を捌けずピーク時間帯に接続が枯渇し新規接続の取得がタイムアウト。machine_type を元に戻して解消済み。",
    confidence: 0.92,
    severity: AlertSeverity.critical(),
    investigationSteps: [
      "直近の terraform 適用差分を確認（VM machine_type 縮小を特定）",
      "接続数・メモリメトリクスと取得待ちタイムアウトの相関を確認",
    ],
    suggestedActions: [
      "machine_type の縮小をロールバックする",
      "VM を縮小する際はピーク帯の実測接続数・メモリ使用量を事前確認する",
    ],
    suggestedPatternName: "DB_CONNECTION_POOL_EXHAUSTION",
    reviewStatus: ReviewStatus.approved(),
    investigatedAt: new Date("2026-05-30T11:55:00.000Z"),
    isFallback: false,
    subject: "google_compute_instance.backbone",
  });

  const base = Alert.createAsUnknown({
    id: new AlertId(FORECAST_MEMORY_SEED_ALERT_IDS.poolShrinkRegression),
    monitoringEvent: pastEvent,
  }).attachInvestigationReport(report);

  return Alert.fromPrimitives({
    ...base.toPrimitives(),
    status: "RESOLVED",
    feedback: {
      isCorrect: true,
      operatorNote: "machine_type を戻して解消（VM 縮小によるメモリ/接続不足が直接原因）",
    },
    correctFeedbackCount: 1,
  });
}

// 週末セールの checkout 負荷で接続待ちが急増した事例。
// subject 先頭トークン "checkout" が schedule seed（土20:00 checkout 負荷x5）と突合する。
function buildWeekendCheckoutPeakAlert(): Alert {
  const pastEvent = new MonitoringEvent({
    eventId: "5eed0000-0000-4000-8000-0000000000e3",
    eventName: "ec.checkout.latency_degraded",
    aggregateId: "5eed0000-0000-4000-8000-0000000000a3",
    occurredOn: new Date("2026-06-20T11:20:00.000Z"),
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.warning(),
    source: "ec-backend",
    payload: { symptom: "checkout latency spike during weekend sale; db connection wait" },
  });

  const report = new InvestigationReport({
    summary:
      "週末セール（土20:00〜）の checkout 集中で DB 接続待ちが急増しレイテンシが劣化。セール時間帯のみ接続プールを一時増強して回避済み。",
    confidence: 0.88,
    severity: AlertSeverity.warning(),
    investigationSteps: [
      "checkout レイテンシの急増時間帯とセール開始時刻の一致を確認",
      "DB 接続待ちキューの伸びを接続数メトリクスで確認",
    ],
    suggestedActions: [
      "セール等の高負荷ウィンドウ前に接続プールを一時増強する",
      "接続上限とピーク負荷の突合を定常運用に組み込む",
    ],
    suggestedPatternName: "DB_CONNECTION_POOL_EXHAUSTION",
    reviewStatus: ReviewStatus.approved(),
    investigatedAt: new Date("2026-06-20T11:50:00.000Z"),
    isFallback: false,
    subject: "checkout_db_connection_pool",
  });

  const base = Alert.createAsUnknown({
    id: new AlertId(FORECAST_MEMORY_SEED_ALERT_IDS.weekendCheckoutPeak),
    monitoringEvent: pastEvent,
  }).attachInvestigationReport(report);

  return Alert.fromPrimitives({
    ...base.toPrimitives(),
    status: "RESOLVED",
    feedback: {
      isCorrect: true,
      operatorNote: "セール時間帯のみプールを一時増強して回避（負荷ウィンドウと接続上限の突合不足）",
    },
    correctFeedbackCount: 1,
  });
}

export const RESOLVED_ALERT_SEEDS: Alert[] = [
  buildResolvedPaymentDeclinedAlert(),
  buildResolvedDbPoolAlert(),
  buildPoolShrinkRegressionAlert(),
  buildWeekendCheckoutPeakAlert(),
];

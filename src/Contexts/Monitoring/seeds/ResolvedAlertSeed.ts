import { Alert } from "../AlertAnalysis/domain/Alert.js";
import { AlertId } from "../AlertAnalysis/domain/AlertId.js";
import { InvestigationReport } from "../AlertAnalysis/domain/InvestigationReport.js";
import { ReviewStatus } from "../AlertAnalysis/domain/ReviewStatus.js";
import { AlertSeverity } from "../Shared/domain/AlertSeverity.js";
import { MonitoringEvent } from "../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategory } from "../Shared/domain/MonitoringEventCategory.js";
import { SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID } from "./ResolvedIncidentSeed.js";

// 「類似・準既知」デモ（シナリオ2）で SIMILARITY 分類が back-link する **過去の解決済み Alert**。
//
// 目的: 類似分類の sourceAlertId（= ResolvedIncident.sourceAlertId）から関連アラートとして
// クリック→詳細を開けるようにする。この Alert が無いと「詳細を開く」が空を開いてしまう。
//
// 一覧には出さない: status=RESOLVED は GET /alerts 一覧から除外する（GetAlertReportUseCase）。
// それでも `GET /alerts/:id` では引けるので、関連アラート導線・ディープリンクからは開ける。
// ＝「作らないと関連として見れないが、一覧には出したくない」の解（過去アラートはアーカイブ扱い）。
const SEED_ALERT_ID = SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID;

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
    id: new AlertId(SEED_ALERT_ID),
    monitoringEvent: pastEvent,
  }).attachInvestigationReport(report);

  return Alert.fromPrimitives({
    ...base.toPrimitives(),
    status: "RESOLVED",
    feedback: { isCorrect: true, operatorNote: "プールサイズ引き上げで解消" },
    correctFeedbackCount: 1,
  });
}

export const RESOLVED_ALERT_SEEDS: Alert[] = [buildResolvedDbPoolAlert()];

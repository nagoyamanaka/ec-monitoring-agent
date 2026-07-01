import { AlertSeverity } from "../Shared/domain/AlertSeverity.js";
import { ResolvedIncident } from "../SimilarIncident/domain/SimilarIncidentRepository.js";

// 「類似・準既知」デモ（シナリオ2）の土台になる過去の解決済みインシデント。
//
// これは KnownErrorPattern（完全一致の高速パス）ではなく、正解フィードバックで蓄積された
// 解決済み事例（SimilarIncident コーパス）。過去に一度 DB コネクションプール枯渇を調査・解決したが、
// まだ既知パターンへは結晶化していない、という状態を再現する。
//
// デモの similar-known シナリオは eventName=ec.db.connection_pool_exhausted の障害を注入する。
// 既知パターンには一致しない（未 seed）が、この解決済み事例と字句類似 0.667 で一致するため
// SimilarPatternRule が source=SIMILARITY・confidence 0.67 の「準・既知」分類を返す。
// resolvedNote は英語の構造化短文にして Jaccard を安定させる（和文プローズは文字 bigram で
// 過剰一致し score が飽和するため避ける＝appcode-regression の注記と同じ配慮の裏返し）。
export const SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID =
  "5eed0000-0000-4000-8000-000000000001";

export const RESOLVED_INCIDENT_SEEDS: ResolvedIncident[] = [
  {
    eventName: "ec.db.connection_pool_exhausted",
    occurredOn: new Date("2026-06-15T09:00:00.000Z"),
    resolvedNote: "database connection pool exhausted; raised pool size",
    severity: AlertSeverity.warning(),
    sourceAlertId: SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID,
  },
];

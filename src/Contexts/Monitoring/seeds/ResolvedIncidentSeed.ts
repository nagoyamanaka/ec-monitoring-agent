import { AlertSeverity } from "../Shared/domain/AlertSeverity.js";
import { ResolvedIncident } from "../SimilarIncident/domain/SimilarIncidentRepository.js";

// 「類似・準既知」デモ（シナリオ2）の土台になる過去の解決済みインシデント。
//
// これは KnownErrorPattern（完全一致の高速パス）ではなく、正解フィードバックで蓄積された
// 解決済み事例（SimilarIncident コーパス）。過去に一度 決済プロバイダ障害（与信拒否）を
// 調査・解決したが、まだ既知パターンへは結晶化していない、という状態を再現する。
//
// デモのシナリオ2（payment-declined ＝実トリガ: PaymentMode=DECLINED の実注文）は
// ec.payment.declined / reason=PROVIDER_UNAVAILABLE の実ドメインイベントを発火する。
// 既知パターン（ec.payment.timeout）には eventName が一致しないが、この解決済み事例と
// 字句類似（Jaccard）で一致し、SimilarPatternRule が source=SIMILARITY の「準・既知」分類を返す。
//
// Jaccard の計算（変更時は再計算すること・SimilarPatternRule.buildQueryText は
// UUID/数値等の発生毎ノイズを除外する）:
//   クエリ = "ec.payment.declined reason=PROVIDER_UNAVAILABLE"
//          → {ec, payment, declined, reason, provider, unavailable}（6）
//   文書   = eventName + resolvedNote
//          → {ec, payment, declined, provider, unavailable, failover}（6）
//   交わり5 / 和7 = 0.714（しきい値 0.6 以上・完全一致 1.0 未満の「準・既知」帯）
//
// resolvedNote は英語の構造化短文にして Jaccard を安定させる（和文プローズは文字 bigram で
// 過剰一致し score が飽和するため避ける）。
export const SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID =
  "5eed0000-0000-4000-8000-000000000004";

export const RESOLVED_INCIDENT_SEEDS: ResolvedIncident[] = [
  {
    eventName: "ec.payment.declined",
    occurredOn: new Date("2026-06-10T13:00:00.000Z"),
    resolvedNote: "provider unavailable; payment declined; provider failover",
    severity: AlertSeverity.warning(),
    sourceAlertId: SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID,
  },
];

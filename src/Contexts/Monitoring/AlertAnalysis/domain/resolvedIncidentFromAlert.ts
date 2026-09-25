import { buildIncidentQueryText } from "../../SimilarIncident/domain/incidentQueryText.js";
import { ResolvedIncident } from "../../SimilarIncident/domain/SimilarIncidentRepository.js";
import { Alert } from "./Alert.js";

// 承認済み Alert を類似コーパス（SimilarIncident）の1件に写す。
// 承認時（SubmitFeedbackUseCase）と再構築時（RebuildSimilarIncidentsUseCase）で**同じ関数**を使うのが要点＝
// ES は Mongo（正本）からいつでも同じ形に作り直せる派生インデックス、という性質をこの1箇所で担保する。
// 呼び出し側が「承認済み」を保証する（ここでは feedback の有無を判定しない）。
export function resolvedIncidentFromAlert(alert: Alert): ResolvedIncident {
  return {
    eventName: alert.monitoringEvent.eventName,
    occurredOn: alert.monitoringEvent.occurredOn,
    // オペレーターのメモ＞AI調査summary＞汎用文字列の順でフォールバック。
    // AI調査結果は手元の alert に載っているので「どう直したか」を記憶に残す。
    resolvedNote:
      alert.feedback?.operatorNote ??
      alert.investigationReport?.summary ??
      "正解フィードバックによる解決",
    // 突合本文は分類側のクエリと同じ関数で作る（表示用 resolvedNote と分離）。これが無いと
    // 和文メモと payload トークンが重ならず、承認した事例が再発しても類似に当たらない。
    searchText: buildIncidentQueryText(alert.monitoringEvent),
    severity: alert.severity,
    // 元アラートへ辿れる back-link（UI ディープリンク用）。再構築の冪等キーでもある。
    sourceAlertId: alert.id.value,
  };
}

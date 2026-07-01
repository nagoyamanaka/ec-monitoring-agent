import { Uuid } from "../../../../Shared/domain/value-object/Uuid.js";
import { Alert } from "../Alert.js";
import { investigationItemText } from "../InvestigationReport.js";
import { KnownErrorPattern } from "../KnownErrorPattern.js";

// Alert（＋その AI 調査レポート）を「完全一致の高速パス」へ焼き付ける KnownErrorPattern を組み立てる。
// 結晶化＝頻出が確定した知識を即・無料・決定論の既知分類に落とす操作（step4-1 2章②）。
// レポートが無い / fallback のときは焼き付ける材料が無いので null を返す（呼び出し側でスキップ）。
// namePrefix で自動昇格（AUTO_PROMOTED）と手動即時昇格（PROMOTED）を区別できるが、
// 生成される分類挙動（eventName のみでマッチ・isPromoted）は同一。
// sourceAlertId を残すのは、承認の撤回（承認→却下）で結晶化を撤回できるようにするため。
export function crystallizePatternFromAlert(
  alert: Alert,
  namePrefix = "PROMOTED",
): KnownErrorPattern | null {
  const report = alert.investigationReport;
  if (report === null || report.isFallback) return null;

  const eventName = alert.monitoringEvent.eventName;
  return KnownErrorPattern.create({
    id: Uuid.random().value,
    name: `${namePrefix}_${eventName.toUpperCase()}`,
    description: report.summary,
    eventNamePattern: eventName,
    payloadConditions: [], // eventName のみでマッチ（安全側）
    severity: report.severity,
    suggestedAction: report.suggestedActions.map(investigationItemText).join("\n"),
    sourceAlertId: alert.id.value,
  }).promote();
}

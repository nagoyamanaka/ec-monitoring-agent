import { Response } from "../../../../Shared/domain/Response.js";
import { Alert } from "../../../AlertAnalysis/domain/Alert.js";

// 調査ライフサイクルの段階（フロントのポーリング用の軽量表現）。
// - collecting: インフラ証拠を収集中（現状は永続化された専用フェーズが無いため予約）
// - analyzing : 未知アラートを AI 調査中（status=ANALYZING・レポート未添付）
// - done      : 既知パターンで triage 済み、または調査レポート添付済み
export type InvestigationStatus = "collecting" | "analyzing" | "done";

export class InvestigationStatusResponse implements Response {
  public readonly alertId: string;
  public readonly status: InvestigationStatus;

  constructor(alert: Alert) {
    this.alertId = alert.id.value;
    this.status = InvestigationStatusResponse.deriveStatus(alert);
  }

  private static deriveStatus(alert: Alert): InvestigationStatus {
    if (alert.investigationReport !== null) return "done";
    if (alert.classification.type === "known") return "done";
    return "analyzing";
  }
}

import { Response } from "../../../../Shared/domain/Response.js";
import { Alert } from "../../domain/Alert.js";

/**
 * 承認済み（＝過去に正しいと判断してクローズした）アラートの一行サマリ。
 * 現役一覧（要対処）から下ろした後も「過去の判断」として analytics から辿れるようにするための表示DTO。
 * id を持つのは詳細（GET /alerts/:id は RESOLVED も返す）への深リンク用。
 */
export type ApprovedAlertSummary = {
  readonly id: string;
  readonly eventName: string;
  readonly category: string;
  readonly severity: string;
  readonly classificationType: "known" | "unknown";
  // 該当した既知パターン名、または未知調査で AI が提案したパターン名（無ければ null）。
  readonly patternName: string | null;
  readonly occurredOn: string;
  readonly occurrenceCount: number;
  // 承認時にオペレーターが残した所見（無ければ null）。
  readonly operatorNote: string | null;
};

// AI 分類の精度トラッキング。オペレーターの承認/却下フィードバックを母数に正答率を出す。
export class AnalyticsResponse implements Response {
  public readonly totalAlerts: number;
  public readonly knownCount: number;
  public readonly unknownCount: number;
  public readonly withFeedbackCount: number;
  public readonly correctCount: number;
  public readonly incorrectCount: number;
  // フィードバック未着時は母数0なので null（0除算回避）
  public readonly accuracy: number | null;
  // 承認済みアラート（過去の判断）の一覧。新しい順。
  public readonly approvedAlerts: ApprovedAlertSummary[];

  constructor(alerts: Alert[]) {
    this.totalAlerts = alerts.length;

    let known = 0;
    let withFeedback = 0;
    let correct = 0;
    const approved: ApprovedAlertSummary[] = [];
    for (const alert of alerts) {
      if (alert.classification.type === "known") known += 1;
      const feedback = alert.feedback;
      if (feedback !== null) {
        withFeedback += 1;
        if (feedback.isCorrect) {
          correct += 1;
          approved.push(toApprovedSummary(alert));
        }
      }
    }

    this.knownCount = known;
    this.unknownCount = this.totalAlerts - known;
    this.withFeedbackCount = withFeedback;
    this.correctCount = correct;
    this.incorrectCount = withFeedback - correct;
    this.accuracy = withFeedback === 0 ? null : correct / withFeedback;
    this.approvedAlerts = approved.sort((a, b) =>
      b.occurredOn.localeCompare(a.occurredOn),
    );
  }
}

function toApprovedSummary(alert: Alert): ApprovedAlertSummary {
  const classification = alert.classification;
  const patternName =
    classification.type === "known"
      ? classification.patternName
      : alert.investigationReport?.suggestedPatternName ?? null;
  return {
    id: alert.id.value,
    eventName: alert.monitoringEvent.eventName,
    category: alert.monitoringEvent.category.value,
    severity: alert.severity.value,
    classificationType: classification.type,
    patternName,
    occurredOn: alert.monitoringEvent.occurredOn.toISOString(),
    occurrenceCount: alert.occurrenceCount,
    operatorNote: alert.feedback?.operatorNote ?? null,
  };
}

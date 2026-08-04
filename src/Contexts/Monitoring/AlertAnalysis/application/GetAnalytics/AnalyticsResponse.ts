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
  // 現役（非 RESOLVED）の件数。一覧（GET /alerts）と同じ軸＝表示件数と一致する。
  public readonly activeAlertCount: number;
  public readonly knownCount: number;
  public readonly unknownCount: number;
  // 判定の総数（＝正答率の母数）。Alert 単位ではなく判定単位で数えるので、
  // 却下 → 再調査 → 承認 は 2 件。feedback（最新の判定）から数えると却下が消える（ADR-27 の測定ギャップ）。
  public readonly withFeedbackCount: number;
  public readonly correctCount: number;
  public readonly incorrectCount: number;
  // フィードバック未着時は母数0なので null（0除算回避）
  public readonly accuracy: number | null;
  // 承認済みアラート（過去の判断）の一覧。新しい順。
  public readonly approvedAlerts: ApprovedAlertSummary[];

  constructor(alerts: Alert[]) {
    this.totalAlerts = alerts.length;
    this.activeAlertCount = alerts.filter(
      (alert) => alert.status.value !== "RESOLVED",
    ).length;

    let known = 0;
    let withFeedback = 0;
    let correct = 0;
    const approved: ApprovedAlertSummary[] = [];
    for (const alert of alerts) {
      if (alert.classification.type === "known") known += 1;
      // 母数は判定の履歴（追記のみ）から数える。承認済み一覧のほうは「いま承認状態か」という
      // 状態の話なので、最新の判定（feedback）から引く＝2つは別の軸で、一致しなくてよい。
      for (const record of alert.reviewHistory) {
        withFeedback += 1;
        if (record.isCorrect) correct += 1;
      }
      if (alert.feedback?.isCorrect === true) {
        approved.push(toApprovedSummary(alert));
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
  // suggestedPatternName は LLM 出力の途中切断→salvage で空文字になり得る（isFallback=false のまま
  // 到達しなかったフィールドが "" に丸められる）。空文字は「推定パターン名なし」なので null に畳んで
  // DTO 契約（無ければ null）と一致させ、表示側の placeholder 分岐を素通りさせない。
  const patternName =
    classification.type === "known"
      ? classification.patternName
      : alert.investigationReport?.suggestedPatternName?.trim() || null;
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

import { Response } from "../../../../Shared/domain/Response.js";
import { Alert } from "../../domain/Alert.js";

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

  constructor(alerts: Alert[]) {
    this.totalAlerts = alerts.length;

    let known = 0;
    let withFeedback = 0;
    let correct = 0;
    for (const alert of alerts) {
      if (alert.classification.type === "known") known += 1;
      const feedback = alert.feedback;
      if (feedback !== null) {
        withFeedback += 1;
        if (feedback.isCorrect) correct += 1;
      }
    }

    this.knownCount = known;
    this.unknownCount = this.totalAlerts - known;
    this.withFeedbackCount = withFeedback;
    this.correctCount = correct;
    this.incorrectCount = withFeedback - correct;
    this.accuracy = withFeedback === 0 ? null : correct / withFeedback;
  }
}

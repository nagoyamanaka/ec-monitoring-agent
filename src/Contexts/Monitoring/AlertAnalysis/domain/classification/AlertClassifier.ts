import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { KnownAlertClassification } from "../AlertClassification.js";

export type AlertClassificationResult =
  | { matched: true; classification: KnownAlertClassification }
  | { matched: false };

// 入ってきた MonitoringEvent（観測）を分類し、AlertClassification を生成する抽象。
// AnalyzeAlertCommandHandler はこの IF にのみ依存する。
export interface AlertClassifier {
  classify(monitoringEvent: MonitoringEvent): Promise<AlertClassificationResult>;
}

import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { AlertClassificationResult } from "./AlertClassifier.js";

// 監視領域（category）ごとの分類戦略。配下の ClassificationRule 群を束ねる。
export interface ClassificationPolicy {
  // この Policy が対象の MonitoringEvent を扱うか（通常は category 一致）
  supports(monitoringEvent: MonitoringEvent): boolean;
  classify(monitoringEvent: MonitoringEvent): Promise<AlertClassificationResult>;
}

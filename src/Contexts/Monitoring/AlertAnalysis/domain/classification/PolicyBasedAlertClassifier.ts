import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { AlertClassificationResult, AlertClassifier } from "./AlertClassifier.js";
import { ClassificationPolicy } from "./ClassificationPolicy.js";

// MonitoringEvent.category を見て担当 Policy にディスパッチするドメインサービス。
export class PolicyBasedAlertClassifier implements AlertClassifier {
  constructor(private readonly policies: ClassificationPolicy[]) {}

  async classify(monitoringEvent: MonitoringEvent): Promise<AlertClassificationResult> {
    const policy = this.policies.find((p) => p.supports(monitoringEvent));
    if (!policy) {
      return { matched: false };
    }
    return policy.classify(monitoringEvent);
  }
}

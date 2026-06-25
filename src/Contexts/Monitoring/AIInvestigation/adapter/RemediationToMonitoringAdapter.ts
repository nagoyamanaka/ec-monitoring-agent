import type { RemediationResponsePrimitives } from "../domain/contracts/RemediationContract.js";
import type { MonitoringRemediationPrimitives } from "../../AlertNotification/domain/MonitoringRemediationPrimitives.js";

export function mapRemediationToMonitoring(rem: RemediationResponsePrimitives): MonitoringRemediationPrimitives {
  const anyR = rem as any;
  return {
    alertId: anyR.alertId ?? anyR.id ?? "",
    status: anyR.status ?? "none",
    pullRequestUrl: anyR.pullRequestUrl ?? null,
    vulnerabilityCount: typeof anyR.vulnerabilityCount === "number" ? anyR.vulnerabilityCount : 0,
    reason: anyR.reason ?? null,
    createdAt: anyR.createdAt ?? null,
  };
}

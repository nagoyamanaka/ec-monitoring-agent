export type MonitoringRemediationResponseStatus = string | "none";

export type MonitoringRemediationPrimitives = {
  readonly alertId: string;
  readonly status: MonitoringRemediationResponseStatus;
  readonly pullRequestUrl: string | null;
  readonly vulnerabilityCount: number;
  readonly reason: string | null;
  readonly createdAt: string | null;
};

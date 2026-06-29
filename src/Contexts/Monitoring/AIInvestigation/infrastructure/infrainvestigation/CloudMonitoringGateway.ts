import { InfraMetric } from "../../domain/InfraEvidence.js";

export interface CloudMonitoringGateway {
  getMetrics(params: {
    occurredOn: Date;
    windowMinutes?: number;
  }): Promise<InfraMetric[]>;
}

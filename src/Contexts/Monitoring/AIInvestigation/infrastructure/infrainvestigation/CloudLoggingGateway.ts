import { AppLogEntry } from "../../domain/InfraEvidence.js";

export interface CloudLoggingGateway {
  getAppLogs(params: {
    service: string;
    occurredOn: Date;
    windowMinutes?: number;
  }): Promise<AppLogEntry[]>;
}

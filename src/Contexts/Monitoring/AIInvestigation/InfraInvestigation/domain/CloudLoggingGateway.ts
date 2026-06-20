import { AppLogEntry } from "./InfraEvidence.js";

export interface CloudLoggingGateway {
  getAppLogs(params: {
    service: string;
    occurredOn: Date;
    windowMinutes?: number;
  }): Promise<AppLogEntry[]>;
}

import { InfraEvidence } from "../InfraInvestigation/domain/InfraEvidence.js";

export type { InfraEvidence };

export interface InvestigationContext {
  readonly errorEvent: {
    eventName: string;
    occurredOn: string;
    payload: Record<string, unknown>;
  };
  readonly knownPatterns: Array<{
    name: string;
    description: string;
    eventNamePattern: string;
  }>;
  readonly similarIncidents: Array<{
    eventName: string;
    occurredOn: string;
    resolvedNote: string;
  }>;
  readonly infraEvidence?: InfraEvidence;
}

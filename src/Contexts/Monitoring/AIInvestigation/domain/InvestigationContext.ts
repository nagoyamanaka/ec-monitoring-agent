import { InfraEvidence } from "./InfraEvidence.js";

export type { InfraEvidence };

export interface InvestigationContext {
  readonly errorEvent: {
    eventName: string;
    occurredOn: string;
    payload: Record<string, unknown>;
    /** ソースが観測時点で付与した重大度。AIはこれを事前情報（prior）として精緻化する。 */
    severity: string;
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

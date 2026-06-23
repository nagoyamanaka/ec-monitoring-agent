import { Response } from "../../../../Shared/domain/Response.js";
import {
  InfraEvidence,
  InfraEvidencePrimitives,
  infraEvidenceToPrimitives,
} from "../../domain/InfraEvidence.js";

export class InfraEvidenceResponse implements Response {
  public readonly evidence: InfraEvidencePrimitives;

  constructor(evidence: InfraEvidence) {
    this.evidence = infraEvidenceToPrimitives(evidence);
  }
}

import { Response } from "../../../../Shared/domain/Response.js";
import { InfraEvidence } from "../../domain/InfraEvidence.js";
import {
  InfraEvidencePrimitives,
  infraEvidenceToPrimitives,
} from "../../domain/contracts/InfraEvidenceContract.js";

export class InfraEvidenceResponse implements Response {
  public readonly evidence: InfraEvidencePrimitives;

  constructor(evidence: InfraEvidence) {
    this.evidence = infraEvidenceToPrimitives(evidence);
  }
}

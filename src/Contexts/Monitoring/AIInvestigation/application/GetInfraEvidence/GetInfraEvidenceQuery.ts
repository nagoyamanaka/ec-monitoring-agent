import { Query } from "../../../../Shared/domain/Query.js";

export class GetInfraEvidenceQuery extends Query {
  constructor(readonly alertId: string) {
    super();
  }
}

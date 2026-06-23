import { Query } from "../../../../Shared/domain/Query.js";

export class GetInvestigationStatusQuery extends Query {
  constructor(readonly alertId: string) {
    super();
  }
}

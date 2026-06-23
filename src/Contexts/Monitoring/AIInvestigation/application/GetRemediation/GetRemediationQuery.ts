import { Query } from "../../../../Shared/domain/Query.js";

export class GetRemediationQuery extends Query {
  constructor(readonly alertId: string) {
    super();
  }
}

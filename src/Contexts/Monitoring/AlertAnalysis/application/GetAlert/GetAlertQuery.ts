import { Query } from "../../../../Shared/domain/Query.js";

export class GetAlertQuery extends Query {
  constructor(readonly alertId: string) {
    super();
  }
}

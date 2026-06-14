import { Query } from "../../../../Shared/domain/Query.js";

export class GetOrderQuery extends Query {
  constructor(readonly orderId: string) {
    super();
  }
}

import { Query } from "./Query.js";
import { Response } from "./Response.js";

export interface QueryHandler<Q extends Query, R extends Response> {
  subscribedTo(): Query;
  handle(query: Q): Promise<R>;
}

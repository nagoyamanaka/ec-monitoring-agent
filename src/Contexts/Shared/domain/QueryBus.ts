import { Query } from "./Query.js";
import { Response } from "./Response.js";

export interface QueryBus {
  ask<R extends Response>(query: Query): Promise<R>;
}

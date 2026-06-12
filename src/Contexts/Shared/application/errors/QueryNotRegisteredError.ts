import { Query } from "../../domain/Query.js";
import { ApplicationError } from "../../domain/errors/ApplicationError.js";

export class QueryNotRegisteredError extends ApplicationError {
  readonly errorCode = "QUERY_NOT_REGISTERED";

  constructor(query: Query) {
    super(`The query <${query.constructor.name}> hasn't a query handler associated`);
  }
}

import { Query } from '../../domain/Query.js';
import { QueryHandler } from '../../domain/QueryHandler.js';
import { Response } from '../../domain/Response.js';
import { QueryNotRegisteredError } from '../../domain/QueryNotRegisteredError.js';

export class QueryHandlers extends Map<Query, QueryHandler<Query, Response>> {
  constructor(queryHandlers: Array<QueryHandler<Query, Response>>) {
    super();
    queryHandlers.forEach(queryHandler => {
      this.set(queryHandler.subscribedTo(), queryHandler);
    });
  }

  public get(query: Query): QueryHandler<Query, Response> {
    const queryHandler = super.get(query.constructor as unknown as Query);

    if (!queryHandler) {
      throw new QueryNotRegisteredError(query);
    }

    return queryHandler;
  }
}

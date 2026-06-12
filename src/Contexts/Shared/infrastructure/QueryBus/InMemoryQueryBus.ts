import { Query } from '../../domain/Query.js';
import { QueryBus } from './../../domain/QueryBus.js';
import { Response } from './../../domain/Response.js';
import { QueryHandlers } from './QueryHandlers.js';

export class InMemoryQueryBus implements QueryBus {
  constructor(private queryHandlersInformation: QueryHandlers) {}

  async ask<R extends Response>(query: Query): Promise<R> {
    const handler = this.queryHandlersInformation.get(query);

    return handler.handle(query) as Promise<R>;
  }
}

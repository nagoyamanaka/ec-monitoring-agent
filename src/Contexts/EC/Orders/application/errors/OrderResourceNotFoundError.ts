import { ApplicationError } from "../../../../Shared/domain/errors/ApplicationError.js";

export class OrderResourceNotFoundError extends ApplicationError {
  readonly errorCode = "ORDER_RESOURCE_NOT_FOUND";

  constructor(resource: string, id: string) {
    super(`${resource} with id <${id}> not found`);
  }
}

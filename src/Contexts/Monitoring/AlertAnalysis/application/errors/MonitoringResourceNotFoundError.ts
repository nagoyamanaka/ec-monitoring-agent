import { ApplicationError } from "../../../../Shared/domain/errors/ApplicationError.js";

export class MonitoringResourceNotFoundError extends ApplicationError {
  readonly errorCode = "MONITORING_RESOURCE_NOT_FOUND";

  constructor(resource: string, id: string) {
    super(`${resource} with id <${id}> not found`);
  }
}

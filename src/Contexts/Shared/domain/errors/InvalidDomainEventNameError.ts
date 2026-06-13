import { DomainError } from "./DomainError.js";

export class InvalidDomainEventNameError extends DomainError {
  readonly errorCode = "INVALID_DOMAIN_EVENT_NAME";

  constructor(expectedPrefix: string, actual: string) {
    super(`Domain event name must start with '${expectedPrefix}', got: ${actual}`);
  }
}

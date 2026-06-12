import { DomainError } from "./DomainError.js";

export class InvalidArgumentError extends DomainError {
  readonly errorCode = "INVALID_ARGUMENT";
}

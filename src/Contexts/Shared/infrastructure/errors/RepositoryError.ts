import { InfrastructureError } from "../../domain/errors/InfrastructureError.js";

export class RepositoryError extends InfrastructureError {
  readonly errorCode = "REPOSITORY_ERROR";

  constructor(operation: string, cause?: unknown) {
    super(
      `Repository operation '${operation}' failed: ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
}

import { InfrastructureError } from "../../domain/errors/InfrastructureError.js";

export class LogWriteError extends InfrastructureError {
  readonly errorCode = "LOG_WRITE_ERROR";

  constructor(cause: unknown) {
    super(
      `Failed to write log: ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
}

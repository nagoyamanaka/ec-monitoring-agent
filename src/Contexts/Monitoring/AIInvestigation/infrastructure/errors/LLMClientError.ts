import { InfrastructureError } from "../../../../Shared/domain/errors/InfrastructureError.js";

export class LLMClientError extends InfrastructureError {
  readonly errorCode = "LLM_CLIENT_ERROR";

  constructor(provider: string, cause: unknown) {
    super(
      `LLM client '${provider}' failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

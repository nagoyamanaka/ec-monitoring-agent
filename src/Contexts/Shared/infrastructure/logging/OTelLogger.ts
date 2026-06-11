import { Logger } from "../../domain/logging/Logger.js";
import { StructuredLog } from "../../domain/logging/StructuredLog.js";

// TODO(Step3): Implement OTel logger that sends to Cloud Logging via
// @google-cloud/opentelemetry-cloud-trace-exporter.
// trace_id and span_id are injected automatically from active OTel span.
export class OTelLogger implements Logger {
  async write(_log: StructuredLog): Promise<void> {
    throw new Error("Not implemented");
  }
}

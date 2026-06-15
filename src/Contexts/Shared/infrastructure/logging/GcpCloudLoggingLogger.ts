import { SpanContext } from "@opentelemetry/api";
import { StructuredLog } from "../../domain/logging/StructuredLog.js";
import { OTelLogger } from "./OTelLogger.js";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID ?? "";

// GCP-specific logger. Adds logging.googleapis.com/* fields so that
// Cloud Logging UI can correlate log entries with Cloud Trace spans.
// stdout is picked up by GCE Ops Agent and forwarded to Cloud Logging.
export class GcpCloudLoggingLogger extends OTelLogger {
  protected override buildEntry(
    log: StructuredLog,
    spanContext: SpanContext | undefined,
  ): Record<string, unknown> {
    const base = super.buildEntry(log, spanContext);

    if (spanContext?.traceId && GCP_PROJECT_ID) {
      base["logging.googleapis.com/trace"] =
        `projects/${GCP_PROJECT_ID}/traces/${spanContext.traceId}`;
      base["logging.googleapis.com/spanId"] = spanContext.spanId;
    }

    return base;
  }
}

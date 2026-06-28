import { trace, SpanContext } from "@opentelemetry/api";
import { Logger } from "../../domain/logging/Logger.js";
import { StructuredLog } from "../../domain/logging/StructuredLog.js";

// Generic OTel-aware structured logger. Writes JSON to stdout.
// Subclasses override buildEntry() to add platform-specific fields.
// trace_id/span_id are injected from the active OTel span when SDK is initialized;
// fall back to values in StructuredLog otherwise (e.g. unit tests).
export class OTelLogger extends Logger {
  async write(log: StructuredLog): Promise<void> {
    const spanContext = trace.getActiveSpan()?.spanContext();
    const entry = this.buildEntry(log, spanContext);

    if (log.severity === "WARNING" || log.severity === "ERROR" || log.severity === "CRITICAL") {
      console.error(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  protected buildEntry(
    log: StructuredLog,
    spanContext: SpanContext | undefined,
  ): Record<string, unknown> {
    const entry: Record<string, unknown> = { ...log };
    if (spanContext) {
      entry.trace_id = spanContext.traceId;
      entry.span_id = spanContext.spanId;
    }
    return entry;
  }
}

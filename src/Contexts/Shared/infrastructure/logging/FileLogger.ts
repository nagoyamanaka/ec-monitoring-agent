import { Logger } from "../../domain/logging/Logger.js";
import { StructuredLog } from "../../domain/logging/StructuredLog.js";
import { LogWriteError } from "../errors/LogWriteError.js";

// TODO(Step3): Implement OTel-based file logger
// Uses @opentelemetry/sdk-node with file exporter
export class FileLogger extends Logger {
  async write(_log: StructuredLog): Promise<void> {
    throw new LogWriteError("Not implemented");
  }
}

import { Logger } from "../../domain/logging/Logger.js";
import { StructuredLog } from "../../domain/logging/StructuredLog.js";

export class ConsoleLogger extends Logger {
  async write(log: StructuredLog): Promise<void> {
    const output = JSON.stringify(log);
    if (log.severity === "WARN" || log.severity === "ERROR" || log.severity === "FATAL") {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}

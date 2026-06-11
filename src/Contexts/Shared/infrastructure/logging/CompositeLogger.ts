import { Logger } from "../../domain/logging/Logger.js";
import { StructuredLog } from "../../domain/logging/StructuredLog.js";

export class CompositeLogger implements Logger {
  constructor(private readonly loggers: Logger[]) {}

  async write(log: StructuredLog): Promise<void> {
    await Promise.allSettled(this.loggers.map((l) => l.write(log)));
  }
}

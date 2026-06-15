import { StructuredLog } from "./StructuredLog.js";

type LogParams = Omit<StructuredLog, "severity" | "timestamp">;

export abstract class Logger {
  abstract write(log: StructuredLog): Promise<void>;

  async debug(params: LogParams): Promise<void> {
    await this.write({ ...params, severity: "DEBUG", timestamp: new Date().toISOString() });
  }

  async info(params: LogParams): Promise<void> {
    await this.write({ ...params, severity: "INFO", timestamp: new Date().toISOString() });
  }

  async warn(params: LogParams): Promise<void> {
    await this.write({ ...params, severity: "WARN", timestamp: new Date().toISOString() });
  }

  async error(params: LogParams): Promise<void> {
    await this.write({ ...params, severity: "ERROR", timestamp: new Date().toISOString() });
  }

  async fatal(params: LogParams): Promise<void> {
    await this.write({ ...params, severity: "FATAL", timestamp: new Date().toISOString() });
  }
}

import { StructuredLog } from "./StructuredLog.js";

export abstract class Logger {
  abstract write(log: StructuredLog): Promise<void>;

  async debug(params: Omit<StructuredLog, "severity">): Promise<void> {
    await this.write({ ...params, severity: "DEBUG" });
  }

  async info(params: Omit<StructuredLog, "severity">): Promise<void> {
    await this.write({ ...params, severity: "INFO" });
  }

  async warn(params: Omit<StructuredLog, "severity">): Promise<void> {
    await this.write({ ...params, severity: "WARN" });
  }

  async error(params: Omit<StructuredLog, "severity">): Promise<void> {
    await this.write({ ...params, severity: "ERROR" });
  }

  async fatal(params: Omit<StructuredLog, "severity">): Promise<void> {
    await this.write({ ...params, severity: "FATAL" });
  }
}

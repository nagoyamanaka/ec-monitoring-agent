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
    await this.write({ ...params, severity: "WARNING", timestamp: new Date().toISOString() });
  }

  async error(params: LogParams): Promise<void> {
    await this.write({ ...params, severity: "ERROR", timestamp: new Date().toISOString() });
  }

  // Cloud Logging の LogSeverity に合わせて CRITICAL を出す
  // （GCP が標準 enum として昇格できる＝ログベースメトリクス/UI が正しく扱える）。
  async critical(params: LogParams): Promise<void> {
    await this.write({ ...params, severity: "CRITICAL", timestamp: new Date().toISOString() });
  }
}

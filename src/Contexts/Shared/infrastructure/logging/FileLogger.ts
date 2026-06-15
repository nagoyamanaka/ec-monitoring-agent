import { Logger } from "../../domain/logging/Logger.js";
import { StructuredLog } from "../../domain/logging/StructuredLog.js";

// コンソール出力による開発用ロガー。OTel統合はインフラ層実装フェーズで差し替える。
export class FileLogger extends Logger {
  async write(log: StructuredLog): Promise<void> {
    const output = JSON.stringify(log);
    if (log.severity === "WARN" || log.severity === "ERROR" || log.severity === "FATAL") {
      console.error(output);
    } else {
      console.log(output);
    }
  }
}

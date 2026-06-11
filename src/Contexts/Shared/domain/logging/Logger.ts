import { StructuredLog } from "./StructuredLog.js";

export interface Logger {
  write(log: StructuredLog): Promise<void>;
}

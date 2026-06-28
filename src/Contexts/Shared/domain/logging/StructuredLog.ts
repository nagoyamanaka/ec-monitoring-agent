export type StructuredLog = {
  // Cloud Logging の LogSeverity 語彙に合わせる（GCP を正・二重 enum での混乱を避ける）。
  // AppLogEntry / AlertSeverities も WARNING/CRITICAL を使っており、これで全層が一致する。
  severity: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  service: string;
  user_id?: string;
  action?: string;
  message: string;
  timestamp: string;
  error_code?: string;
  retry_count?: number;
  stack_trace?: string;
}

export type StructuredLog = {
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  service: string;
  user_id?: string;
  action?: string;
  message: string;
  timestamp: string;
  error_code?: string;
  retry_count?: number;
  stack_trace?: string;
}

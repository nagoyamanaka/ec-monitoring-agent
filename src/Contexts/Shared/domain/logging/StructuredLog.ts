export interface StructuredLog {
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  service: string;
  trace_id: string;
  span_id: string;
  user_id?: string;
  action?: string;
  message: string;
  timestamp: string;
  error_code?: string;
  retry_count?: number;
  stack_trace?: string;
}

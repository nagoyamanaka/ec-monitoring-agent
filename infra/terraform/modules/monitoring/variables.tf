variable "project_id" {
  type = string
}

variable "ingest_webhook_url" {
  type        = string
  description = "Cloud Run /ingest/cloud-monitoring の URL"
}

variable "cloud_run_service_name" {
  type = string
}

variable "error_threshold" {
  type    = number
  default = 1
}

variable "critical_log_metric" {
  type        = string
  description = "logging module が作る CRITICAL ログベースメトリクス名（user/<name> として参照）"
}

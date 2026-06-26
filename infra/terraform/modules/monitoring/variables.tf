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

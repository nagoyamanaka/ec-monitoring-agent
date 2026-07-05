variable "project_id" {
  type        = string
  description = "GCP project id"
}

variable "region" {
  type        = string
  description = "Cloud SQL instance region"
  default     = "asia-northeast1"
}

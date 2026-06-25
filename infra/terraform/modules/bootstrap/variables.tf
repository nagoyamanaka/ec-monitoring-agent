variable "project_id" {
  type        = string
  description = "GCP project id"
}

variable "region" {
  type        = string
  description = "GCP region (Artifact Registry / deploy bucket)"
}

variable "artifact_repo_id" {
  type        = string
  description = "Artifact Registry repository id (Docker)"
  default     = "apps"
}

variable "deploy_bucket_name" {
  type        = string
  description = "GCS bucket name for deploy artifacts (globally unique)"
}

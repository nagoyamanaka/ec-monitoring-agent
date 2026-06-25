variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-northeast1"
}

variable "zone" {
  type    = string
  default = "asia-northeast1-a"
}

variable "github_repository" {
  type        = string
  description = "owner/repo allowed to deploy via WIF (e.g. shigeyasushimamura/ec-monitoring-agent)"
}

variable "artifact_repo_id" {
  type    = string
  default = "apps"
}

variable "deploy_bucket_name" {
  type        = string
  description = "GCS bucket for deploy artifacts (globally unique)"
}

# 未指定なら Artifact Registry の規定パスを使う
variable "image_ec" {
  type    = string
  default = null
}

variable "image_backoffice" {
  type    = string
  default = null
}

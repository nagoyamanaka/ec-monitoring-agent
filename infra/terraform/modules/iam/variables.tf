variable "project_id" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "owner/repo allowed to assume the deployer SA"
}

variable "pool_id" {
  type    = string
  default = "github-pool"
}

variable "provider_id" {
  type    = string
  default = "github-oidc"
}

variable "deployer_sa_id" {
  type    = string
  default = "ci-deployer"
}

variable "deployer_roles" {
  type        = list(string)
  description = "Project roles granted to the CI deployer SA"
  default = [
    "roles/run.admin",
    "roles/compute.admin",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.admin",
    "roles/storage.admin",
    "roles/artifactregistry.writer",
    "roles/monitoring.editor",
    "roles/logging.configWriter",
    "roles/vpcaccess.admin",
  ]
}

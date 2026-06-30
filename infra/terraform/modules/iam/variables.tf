variable "project_id" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "owner/repo allowed to assume the deployer SA"
}

# CI が実際に impersonate する既存の WIF プール／プロバイダ／SA に揃える。
# （旧 github-pool / ci-deployer は未使用のため統合・削除。詳細は移行 runbook 参照）
variable "pool_id" {
  type    = string
  default = "github-actions-pool2"
}

variable "provider_id" {
  type    = string
  default = "github-provider"
}

variable "deployer_sa_id" {
  type    = string
  default = "terraform-deployer"
}

variable "deployer_roles" {
  type        = list(string)
  description = "Project roles granted to the CI deployer SA"
  default = [
    "roles/run.admin",
    "roles/compute.admin",
    "roles/compute.osAdminLogin",
    "roles/iap.tunnelResourceAccessor",
    "roles/iam.serviceAccountUser",
    "roles/secretmanager.admin",
    "roles/storage.admin",
    "roles/artifactregistry.writer",
    "roles/monitoring.editor",
    "roles/logging.configWriter",
    "roles/vpcaccess.admin",
  ]
}

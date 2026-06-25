terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

locals {
  # 有効化する GCP API（§11.5）
  services = [
    "run.googleapis.com",
    "compute.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "aiplatform.googleapis.com",
    "secretmanager.googleapis.com",
    "vpcaccess.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "sts.googleapis.com",
  ]

  # Secret コンテナ（値=version は tf に置かず gcloud で投入する。§11.5）
  secret_ids = ["GEMINI_API_KEY", "INGEST_TOKEN"]
}

resource "google_project_service" "this" {
  for_each           = toset(local.services)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# アプリイメージ（ec-backend / backoffice-backend）の置き場
resource "google_artifact_registry_repository" "apps" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo_id
  format        = "DOCKER"
  description   = "ec-monitoring-agent container images"

  depends_on = [google_project_service.this]
}

# デプロイ資材（docker-compose.prod.yml）の置き場。GCE startup-script が pull する（§11.5）
resource "google_storage_bucket" "deploy" {
  project                     = var.project_id
  name                        = var.deploy_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  depends_on = [google_project_service.this]
}

# Secret は「箱」だけ作る。平文（version）は tf に置かない:
#   echo -n "<value>" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
resource "google_secret_manager_secret" "this" {
  for_each  = toset(local.secret_ids)
  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.this]
}

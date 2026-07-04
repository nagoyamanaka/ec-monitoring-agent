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
    # IAP TCP forwarding（CI の gcloud compute ssh --tunnel-through-iap）に必須。
    # 未有効だとトンネル確立時に 4033 'not authorized' で失敗する。
    "iap.googleapis.com",
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
    # cloudtrace.googleapis.com は意図的に未有効化（現状ギャップ・ROI 低で審査時は見送り）。
    # start.ts が OTel の TraceExporter でスパンを送出し、SA には roles/cloudtrace.agent も付与済みだが、
    # この API 未有効のためスパンは Cloud Trace に着かない（ログ↔トレース相関フィールドは出る）。
    # 分散トレースを実際に可視化したくなったら次の1行を有効化するだけでよい。
    # "cloudtrace.googleapis.com",
  ]

  # Secret コンテナ（値=version は tf に置かず gcloud で投入する。§11.5）
  # Gemini は Vertex AI 経由（ADC 認証）なので API キー Secret は不要。
  # AI Studio フォールバックを使う場合のみ手動で GEMINI_API_KEY Secret を足す。
  # GITHUB_TOKEN は AI 調査の証拠収集（コミット履歴）＋証拠リンク＋修正PR起票で使う read-only PAT。
  # version 未投入でも startup-script はフォールバックで空にするため VM 起動は止まらない（silent skip）。
  secret_ids = ["INGEST_TOKEN", "GITHUB_TOKEN"]
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
#   echo -n "<value>" | gcloud secrets versions add INGEST_TOKEN --data-file=-
resource "google_secret_manager_secret" "this" {
  for_each  = toset(local.secret_ids)
  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.this]
}

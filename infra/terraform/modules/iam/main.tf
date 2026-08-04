terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

# GitHub Actions → GCP のキーレス認証（WIF・§11.5）
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = var.pool_id
  display_name              = var.pool_id
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = var.provider_id
  display_name                       = var.provider_id

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  # 指定リポジトリからのトークンのみ受け付ける
  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
    # 既存プロバイダ（手動作成）の許可 audience を明示し、import 後に剥がさない。
    # CI（google-github-actions/auth）は audience 未指定でデフォルト（= プロバイダ URL）を使う。
    allowed_audiences = var.provider_allowed_audiences
  }
}

# CI が impersonate するデプロイ用 SA
resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = var.deployer_sa_id
  display_name = "CI deployer (Terraform / Cloud Run / GCE)"
}

resource "google_project_iam_member" "deployer" {
  for_each = toset(var.deployer_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

# 指定 GitHub repo の principalSet が deployer SA を impersonate できる
resource "google_service_account_iam_member" "wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# AI リメディエーションジョブ（ai-remediation.yml）専用 SA。
# deployer を使い回さないのは、修正ジョブに必要なのが Vertex AI の呼び出しだけで、
# Cloud Run / GCE / Secret Manager への権限が要らないため（LLM が書いたコードを走らせる
# ランナーに、デプロイできる資格情報を置かない）。
resource "google_service_account" "remediation" {
  project      = var.project_id
  account_id   = var.remediation_sa_id
  display_name = "CI AI remediation (Vertex AI only)"
}

resource "google_project_iam_member" "remediation" {
  for_each = toset(var.remediation_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.remediation.email}"
}

resource "google_service_account_iam_member" "wif_remediation" {
  service_account_id = google_service_account.remediation.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

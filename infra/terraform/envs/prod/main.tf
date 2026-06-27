locals {
  ar_host          = "${var.region}-docker.pkg.dev"
  image_ec         = coalesce(var.image_ec, "${local.ar_host}/${var.project_id}/${var.artifact_repo_id}/ec-backend:latest")
  image_backoffice = coalesce(var.image_backoffice, "${local.ar_host}/${var.project_id}/${var.artifact_repo_id}/backoffice-backend:latest")
  # 初回 apply 時は AR にイメージが存在しないため nginx:alpine をフォールバックに使用。
  # 実イメージは CI（build-push-frontend）が push 後に `gcloud run services update` で差し替える。
  image_frontend = coalesce(var.image_frontend, "nginx:alpine")
}

# API 有効化 / Artifact Registry / deploy bucket / Secret 箱
module "bootstrap" {
  source             = "../../modules/bootstrap"
  project_id         = var.project_id
  region             = var.region
  artifact_repo_id   = var.artifact_repo_id
  deploy_bucket_name = var.deploy_bucket_name
}

# VPC / subnet / Serverless VPC Access connector / firewall
module "networking" {
  source     = "../../modules/networking"
  project_id = var.project_id
  region     = var.region
}

# GitHub Actions 用 WIF + deployer SA
module "iam" {
  source            = "../../modules/iam"
  project_id        = var.project_id
  github_repository = var.github_repository

  depends_on = [module.bootstrap]
}

# 常駐 backbone（RabbitMQ/Mongo/ES/Valkey + worker）
module "gce_backbone" {
  source             = "../../modules/gce-backbone"
  project_id         = var.project_id
  region             = var.region
  zone               = var.zone
  subnet_id          = module.networking.subnet_id
  artifact_host      = local.ar_host
  gcs_compose_bucket = module.bootstrap.deploy_bucket
  image_ec           = local.image_ec
  image_backoffice   = local.image_backoffice

  depends_on = [module.bootstrap]
}

# 配信エッジ（クエリ/SSE）
module "cloud_run" {
  source               = "../../modules/cloud-run"
  project_id           = var.project_id
  region               = var.region
  image                = local.image_backoffice
  vpc_connector_id     = module.networking.connector_id
  backbone_internal_ip = module.gce_backbone.internal_ip
  # edge は ROLE=edge（consumer を張らない）＋ Valkey Pub/Sub fan-out なので scale-to-zero 可。
  # 常駐 RabbitMQ Subscriber は GCE worker（ROLE=worker）が担う。
  min_instances = 0
  max_instances = 2

  depends_on = [module.bootstrap]
}

# フロントエンド（nginx static + API リバースプロキシ）
module "cloud_run_frontend" {
  source           = "../../modules/cloud-run-frontend"
  project_id       = var.project_id
  region           = var.region
  image            = local.image_frontend
  backend_edge_url = module.cloud_run.service_uri

  depends_on = [module.bootstrap, module.cloud_run]
}

# Cloud Monitoring webhook チャネル + サンプル Alerting Policy
module "monitoring" {
  source                 = "../../modules/monitoring"
  project_id             = var.project_id
  ingest_webhook_url     = "${module.cloud_run.service_uri}/ingest/cloud-monitoring"
  cloud_run_service_name = module.cloud_run.service_name

  depends_on = [module.bootstrap]
}

# ログベースメトリクス
module "logging" {
  source     = "../../modules/logging"
  project_id = var.project_id

  depends_on = [module.bootstrap]
}

# GCE backbone SA に deploy bucket へのアクセス権限を付与
resource "google_storage_bucket_iam_member" "backbone_deploy_reader" {
  bucket = module.bootstrap.deploy_bucket
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${module.gce_backbone.vm_sa_email}"
}

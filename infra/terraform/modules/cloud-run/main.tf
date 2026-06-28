terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

locals {
  # backbone へは VPC connector 越しに内部 IP で到達（§11.1）
  computed_env = {
    MONGO_URL         = "mongodb://${var.backbone_internal_ip}:27017/monitoring"
    ELASTICSEARCH_URL = "http://${var.backbone_internal_ip}:9200"
    REDIS_URL         = "redis://${var.backbone_internal_ip}:6379"
    RABBITMQ_HOST     = var.backbone_internal_ip
    # Vertex AI（ADC）が課金紐付けに使う project。GEMINI_API_KEY は不要。
    GOOGLE_CLOUD_PROJECT = var.project_id
    # GcpCloudLoggingLogger が logging.googleapis.com/trace フィールドを組み立てるために必須。
    GCP_PROJECT_ID = var.project_id
    # デモシナリオが EC backend を叩く接続先（VPC connector 経由で GCE 内部 IP に到達）
    EC_BACKEND_URL = "http://${var.backbone_internal_ip}:3000"
    # 配信エッジ役（クエリ/SSE）。RabbitMQ consumer は張らず（GCE worker が担う）、
    # SSE は Valkey Pub/Sub を購読して fan-out する（RedisSSEAlertNotifier・task17/19）。
    # これにより min-instances=0（scale-to-zero）にしても worker 側でイベント処理が継続する。
    ROLE = "edge"
  }
  all_env = merge(local.computed_env, var.plain_env)
}

resource "google_service_account" "run" {
  project      = var.project_id
  account_id   = var.run_sa_id
  display_name = "Cloud Run backoffice edge"
}

resource "google_project_iam_member" "run" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/cloudtrace.agent",
    "roles/aiplatform.user",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.run.email}"
}

# 配信エッジ（クエリ/SSE）。worker/edge をコード分離（ROLE）した後は edge は RabbitMQ consumer を
# 持たず GCE worker が常駐処理を担うため、min-instances=0（scale-to-zero）で運用できる（§11.3）。
resource "google_cloud_run_v2_service" "edge" {
  project             = var.project_id
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.run.email

    # SSE 長時間接続のためリクエストタイムアウトを延長（Cloud Run v2 上限 3600s）。
    # heartbeat 30s（AlertsStreamController）はアイドル切断を防ぐが、最大リクエスト時間の上限とは別。
    timeout = "3600s"

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.image

      ports {
        container_port = var.container_port
      }

      startup_probe {
        timeout_seconds   = 10
        period_seconds    = 10
        failure_threshold = 24

        tcp_socket {
          port = var.container_port
        }
      }

      dynamic "env" {
        for_each = local.all_env
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secret Manager 参照（INGEST_TOKEN）
      dynamic "env" {
        for_each = var.secret_env
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = "latest"
            }
          }
        }
      }
    }
  }
}

# 公開（Cloud Monitoring webhook 受信 + UI）。/ingest は INGEST_TOKEN で保護（§11.2）
resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.edge.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

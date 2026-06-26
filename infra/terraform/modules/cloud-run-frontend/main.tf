terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

# nginx static 配信 + API リバースプロキシ。VPC 不要（backend は public URL 経由）。
resource "google_cloud_run_v2_service" "frontend" {
  project             = var.project_id
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  # イメージは CI（build-push-frontend ジョブ）が管理するため terraform では追跡しない。
  # 初回 apply 時は var.image が AR に存在しない場合でも terraform は失敗しない。
  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  template {
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      ports {
        container_port = 80
      }

      startup_probe {
        timeout_seconds   = 5
        period_seconds    = 10
        failure_threshold = 6

        tcp_socket {
          port = 80
        }
      }

      env {
        name  = "BACKEND_EDGE_URL"
        value = var.backend_edge_url
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

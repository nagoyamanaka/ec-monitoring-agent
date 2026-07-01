terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

# Cloud Monitoring → Webhook 通知チャネル → /ingest/cloud-monitoring（§11.2）
#
# webhook_tokenauth は GCP 側がトークンを URL クエリ（?token=）に付与する。
# auth_token を明示指定しないと GCP がランダム生成した値を付けるため、edge の
# INGEST_TOKEN と一致せず ingest コントローラが 401 で弾く（経路B が webhook で切れる）。
# ここで auth_token を INGEST_TOKEN と同値に固定して照合を通す。
# コントローラは既に ?token= と x-ingest-token ヘッダの両経路を受理する実装。
resource "google_monitoring_notification_channel" "ingest_webhook" {
  project      = var.project_id
  display_name = "ec-monitoring-agent ingest webhook"
  type         = "webhook_tokenauth"

  labels = {
    url = var.ingest_webhook_url
  }

  sensitive_labels {
    auth_token = var.ingest_token
  }
}

# サンプル Alerting Policy: Cloud Run の 5xx 増加で発火（INFRASTRUCTURE 系の検知例）
resource "google_monitoring_alert_policy" "cloud_run_5xx" {
  project      = var.project_id
  display_name = "Cloud Run 5xx 増加 (${var.cloud_run_service_name})"
  combiner     = "OR"

  conditions {
    display_name = "5xx request rate"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.cloud_run_service_name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.error_threshold
      duration        = "60s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.ingest_webhook.id]
}

# CRITICAL ログ起点の Alerting Policy（#4）。ログエントリを直接マッチする condition_matched_log を使用。
# condition_threshold + log-based metric は resource.type が cloud_run_revision/gce_instance の両方に
# またがるため有効な組み合わせを単一フィルターで表現できず、condition_matched_log に切替。
resource "google_monitoring_alert_policy" "critical_log" {
  project      = var.project_id
  display_name = "アプリ CRITICAL ログ検知"
  combiner     = "OR"

  conditions {
    display_name = "CRITICAL log entries"
    condition_matched_log {
      filter = "(resource.type=\"cloud_run_revision\" OR resource.type=\"gce_instance\") AND severity>=\"CRITICAL\""
    }
  }

  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
  }

  notification_channels = [google_monitoring_notification_channel.ingest_webhook.id]
}

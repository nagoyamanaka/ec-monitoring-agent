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
# 注意（wiring）: webhook_tokenauth は GCP 側がトークンを URL クエリに付与する。
# ingest コントローラは x-ingest-token ヘッダ前提なので、いずれかの対応が要る:
#   (a) コントローラを ?token= でも受理するよう拡張、または
#   (b) basic 認証チャネル（webhook_basicauth）に切替。
# ここでは tokenauth を採用。詳細は infra/terraform/README.md。
resource "google_monitoring_notification_channel" "ingest_webhook" {
  project      = var.project_id
  display_name = "ec-monitoring-agent ingest webhook"
  type         = "webhook_tokenauth"

  labels = {
    url = var.ingest_webhook_url
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

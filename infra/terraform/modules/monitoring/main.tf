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
# webhook 通知チャネル → /ingest/cloud-monitoring（経路B）。
# webhook_tokenauth の token は GCP 生成で固定できず（許可ラベルは url のみ）edge の
# INGEST_TOKEN と一致させられないため、basicauth を採用する。GCP は
# Authorization: Basic base64(username:password) を送るので、password を INGEST_TOKEN と
# 同値に固定し、ingest コントローラが Basic のパスワードを照合する（username は照合しない）。
resource "google_monitoring_notification_channel" "ingest_webhook" {
  project      = var.project_id
  display_name = "ec-monitoring-agent ingest webhook"
  type         = "webhook_basicauth"

  labels = {
    url      = var.ingest_webhook_url
    username = "monitoring"
  }

  sensitive_labels {
    password = var.ingest_token
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
      # マッチした CRITICAL ログの中身（StructuredLog の service/action/message）を発報に運ぶ。
      # 抜いた値は下の documentation の $${log.extracted_label.*} に展開され、webhook の
      # incident.documentation.content として ingest → UI の「発報内容」に表示される。
      label_extractors = {
        service     = "EXTRACT(jsonPayload.service)"
        action      = "EXTRACT(jsonPayload.action)"
        log_message = "EXTRACT(jsonPayload.message)"
      }
    }
  }

  # eventName（condition 名の slug）は dedup/分類キーで情報を運べないため、
  # 「何が・どこで起きたか」はここが運ぶ。行構成は合成注入版（scenario 3b の
  # buildInfraFaultSyntheticWebhook）と揃えている＝片方だけ変えると 3/3b の見え方が乖離する。
  documentation {
    mime_type = "text/markdown"
    content   = <<-EOT
      対象サービス: $${log.extracted_label.service}（action: $${log.extracted_label.action}）
      検知ログ: $${log.extracted_label.log_message}
      発火条件: Cloud Run（edge）/ GCE backbone（worker）の severity>=CRITICAL ログ
    EOT
  }

  # 注意: condition_matched_log（ログ一致）ポリシーは alert_strategy.auto_close を受け付けない
  # （API が read-only 扱いで 400 を返す。ログ一致インシデントのクローズ挙動は Cloud Monitoring 固定）。
  # そのため実 CM 経路（scenario 4）のインシデント残留は API/IaC からは制御できない。デモの反復・
  # 時刻ずれ回避は合成注入版（scenario 4b＝GCP にインシデントを残さず started_at=now）で行う。
  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
  }

  notification_channels = [google_monitoring_notification_channel.ingest_webhook.id]
}

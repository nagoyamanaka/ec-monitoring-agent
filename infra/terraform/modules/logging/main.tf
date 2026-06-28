terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

# 構造化ログ（StructuredLog）からのログベースメトリクス例。
# アプリが action="alert_ingested" を吐く前提（無くても害なし・0 件）。
resource "google_logging_metric" "alert_ingested" {
  project = var.project_id
  name    = "ec_monitoring_alert_ingested"
  filter  = "resource.type=\"cloud_run_revision\" AND jsonPayload.action=\"alert_ingested\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# 致命的ログ検知メトリクス（#4: アプリのエラーログ起点の自動発報）。
# アプリの logger.critical() は Cloud Logging 標準語彙の severity="CRITICAL" を吐く
# （start.ts の bootstrap 失敗等。GcpCloudLoggingLogger → stdout/stderr 経由）。
# CRITICAL は標準 LogSeverity なので Cloud Logging が LogEntry.severity へ昇格させる
# ＝ jsonPayload を覗くハックは不要で severity フィルタだけで拾える。
#
# 拾う対象: Cloud Run（edge）と GCE backbone（worker, Ops Agent 経由）の両方。
resource "google_logging_metric" "critical_log" {
  project = var.project_id
  name    = "ec_monitoring_critical_log"
  filter  = <<-EOT
    (resource.type="cloud_run_revision" OR resource.type="gce_instance")
    AND severity>="CRITICAL"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

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

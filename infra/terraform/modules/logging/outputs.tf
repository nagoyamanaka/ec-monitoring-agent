output "alert_ingested_metric" {
  value = google_logging_metric.alert_ingested.name
}

output "critical_log_metric" {
  value = google_logging_metric.critical_log.name
}

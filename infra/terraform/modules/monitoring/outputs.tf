output "notification_channel_id" {
  value = google_monitoring_notification_channel.ingest_webhook.id
}

output "alert_policy_id" {
  value = google_monitoring_alert_policy.cloud_run_5xx.id
}

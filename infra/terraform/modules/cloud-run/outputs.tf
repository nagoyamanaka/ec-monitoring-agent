output "service_uri" {
  value = google_cloud_run_v2_service.edge.uri
}

output "service_name" {
  value = google_cloud_run_v2_service.edge.name
}

output "run_sa_email" {
  value = google_service_account.run.email
}

output "workload_identity_provider" {
  description = "Full provider name for google-github-actions/auth"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_sa_email" {
  value = google_service_account.deployer.email
}

output "artifact_repo" {
  description = "Artifact Registry repo path (host/project/repo)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.apps.repository_id}"
}

output "deploy_bucket" {
  description = "Deploy artifacts bucket name"
  value       = google_storage_bucket.deploy.name
}

output "secret_ids" {
  description = "Created Secret Manager secret ids"
  value       = [for s in google_secret_manager_secret.this : s.secret_id]
}

output "cloud_run_url" {
  description = "配信エッジ URL（UI / webhook の基底）"
  value       = module.cloud_run.service_uri
}

output "frontend_url" {
  description = "フロントエンド公開 URL（審査員に渡す）"
  value       = module.cloud_run_frontend.service_uri
}

output "ingest_webhook_url" {
  value = "${module.cloud_run.service_uri}/ingest/cloud-monitoring"
}

output "backbone_internal_ip" {
  value = module.gce_backbone.internal_ip
}

output "artifact_repo" {
  value = module.bootstrap.artifact_repo
}

output "deploy_bucket" {
  value = module.bootstrap.deploy_bucket
}

output "workload_identity_provider" {
  description = "GitHub Actions の google-github-actions/auth に渡す"
  value       = module.iam.workload_identity_provider
}

output "deployer_sa_email" {
  value = module.iam.deployer_sa_email
}

output "remediation_sa_email" {
  description = "AI リメディエーションジョブ用 SA（GitHub Actions Variables の REMEDIATION_SA へ）"
  value       = module.iam.remediation_sa_email
}

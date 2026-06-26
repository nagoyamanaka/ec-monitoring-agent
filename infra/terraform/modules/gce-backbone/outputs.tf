output "internal_ip" {
  description = "backbone 内部固定 IP（Cloud Run edge から Valkey/Mongo/ES へ）"
  value       = google_compute_address.internal.address
}

output "instance_name" {
  value = google_compute_instance.backbone.name
}

output "vm_sa_email" {
  value = google_service_account.vm.email
}

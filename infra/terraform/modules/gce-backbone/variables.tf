variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "zone" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "instance_name" {
  type    = string
  default = "ec-monitoring-backbone"
}

variable "machine_type" {
  type        = string
  description = "RabbitMQ + Mongo + Elasticsearch + Valkey + worker を同居させる（§11.1）"
  default     = "e2-standard-2"
}

variable "image" {
  type    = string
  default = "ubuntu-os-cloud/ubuntu-2204-lts"
}

variable "boot_disk_gb" {
  type    = number
  default = 30
}

variable "vm_sa_id" {
  type    = string
  default = "backbone-vm"
}

variable "artifact_host" {
  type        = string
  description = "Artifact Registry host, e.g. asia-northeast1-docker.pkg.dev"
}

variable "gcs_compose_bucket" {
  type        = string
  description = "Bucket holding docker-compose.prod.yml"
}

variable "gcs_compose_object" {
  type        = string
  description = "Object name of the compose file (no slashes)"
  default     = "docker-compose.prod.yml"
}

variable "image_ec" {
  type = string
}

variable "image_backoffice" {
  type = string
}

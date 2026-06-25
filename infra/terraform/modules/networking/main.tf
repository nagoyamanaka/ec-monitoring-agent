terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = var.network_name
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  project                  = var.project_id
  name                     = "${var.network_name}-subnet"
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true
}

# Serverless VPC Access: Cloud Run → GCE backbone（Valkey/Mongo/ES）への内部到達（§11.1）
resource "google_vpc_access_connector" "connector" {
  project       = var.project_id
  name          = var.connector_name
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = var.connector_cidr
  min_instances = 2
  max_instances = 3
}

# Cloud Run connector / subnet 内から backbone の各サービスポートのみ許可
resource "google_compute_firewall" "internal" {
  project = var.project_id
  name    = "${var.network_name}-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["6379", "27017", "5672", "9200", "3001"]
  }

  source_ranges = [var.subnet_cidr, var.connector_cidr]
  target_tags   = ["backbone"]
}

# IAP 経由 SSH（運用アクセス）
resource "google_compute_firewall" "ssh_iap" {
  project = var.project_id
  name    = "${var.network_name}-allow-ssh-iap"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["backbone"]
}

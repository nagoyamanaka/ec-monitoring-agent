terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

# backbone VM の SA（Secret 取得・ログ送信・AR pull・Gemini/Vertex）
resource "google_service_account" "vm" {
  project      = var.project_id
  account_id   = var.vm_sa_id
  display_name = "GCE backbone (worker + stateful infra)"
}

resource "google_project_iam_member" "vm" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/artifactregistry.reader",
    "roles/storage.objectViewer",
    "roles/aiplatform.user",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.vm.email}"
}

# Cloud Run edge から安定参照するための内部固定 IP
resource "google_compute_address" "internal" {
  project      = var.project_id
  name         = "${var.instance_name}-internal"
  subnetwork   = var.subnet_id
  address_type = "INTERNAL"
  region       = var.region
}

resource "google_compute_instance" "backbone" {
  project      = var.project_id
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["backbone"]

  boot_disk {
    initialize_params {
      image = var.image
      size  = var.boot_disk_gb
    }
  }

  network_interface {
    subnetwork = var.subnet_id
    network_ip = google_compute_address.internal.address
    # AR pull / get.docker.com のため ephemeral 外部 IP を付与。
    # Cloud NAT を入れるなら access_config ブロックごと削除してよい。
    access_config {}
  }

  service_account {
    email  = google_service_account.vm.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  # Docker + compose を入れ、GCS から docker-compose.prod.yml を取得して起動（§11.1/§11.5）
  metadata_startup_script = templatefile("${path.module}/startup-script.sh.tftpl", {
    project_id       = var.project_id
    artifact_host    = var.artifact_host
    compose_bucket   = var.gcs_compose_bucket
    compose_object   = var.gcs_compose_object
    image_ec         = var.image_ec
    image_backoffice = var.image_backoffice
  })

  allow_stopping_for_update = true

  lifecycle {
    # startup-script 更新だけで再作成しない（手動 reset 運用）
    ignore_changes = [metadata_startup_script]
  }
}

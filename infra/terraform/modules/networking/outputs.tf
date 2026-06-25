output "network_id" {
  value = google_compute_network.vpc.id
}

output "network_name" {
  value = google_compute_network.vpc.name
}

output "subnet_id" {
  value = google_compute_subnetwork.subnet.id
}

output "connector_id" {
  value = google_vpc_access_connector.connector.id
}

output "connector_name" {
  value = google_vpc_access_connector.connector.name
}

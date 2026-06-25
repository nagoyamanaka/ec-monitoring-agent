variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "network_name" {
  type    = string
  default = "ec-monitoring"
}

variable "subnet_cidr" {
  type    = string
  default = "10.10.0.0/24"
}

variable "connector_name" {
  type    = string
  default = "ec-monitoring-conn"
}

variable "connector_cidr" {
  type        = string
  description = "Serverless VPC Access connector range (/28, must not overlap subnet)"
  default     = "10.8.0.0/28"
}

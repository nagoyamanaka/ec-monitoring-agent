variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "service_name" {
  type    = string
  default = "backoffice-frontend"
}

variable "image" {
  type        = string
  description = "nginx runner ステージのコンテナイメージ"
}

variable "backend_edge_url" {
  type        = string
  description = "nginx が proxy_pass する先の Cloud Run edge URL（例: https://backoffice-edge-xxx-an.a.run.app）"
}

variable "min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 4
}

variable "allow_unauthenticated" {
  type    = bool
  default = true
}

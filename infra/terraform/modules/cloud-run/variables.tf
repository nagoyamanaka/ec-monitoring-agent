variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "service_name" {
  type    = string
  default = "backoffice-edge"
}

variable "image" {
  type        = string
  description = "backoffice 配信エッジのコンテナイメージ"
}

variable "container_port" {
  type    = number
  default = 3001
}

variable "vpc_connector_id" {
  type = string
}

variable "backbone_internal_ip" {
  type = string
}

variable "run_sa_id" {
  type    = string
  default = "backoffice-edge"
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

variable "plain_env" {
  type        = map(string)
  description = "非機密の環境変数（computed_env とマージ）"
  default = {
    RABBITMQ_PORT  = "5672"
    RABBITMQ_USER  = "guest"
    RABBITMQ_PASS  = "guest"
    RABBITMQ_VHOST = "/"
    EXCHANGE_NAME  = "ec-domain-events"
    DEMO_ENABLED   = "false"
  }
}

variable "secret_env" {
  type = list(object({
    name   = string
    secret = string
  }))
  description = "Secret Manager から注入する env"
  default = [
    { name = "GEMINI_API_KEY", secret = "GEMINI_API_KEY" },
    { name = "INGEST_TOKEN", secret = "INGEST_TOKEN" },
  ]
}

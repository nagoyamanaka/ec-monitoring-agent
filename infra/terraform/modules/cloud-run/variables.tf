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
    GEMINI_MODEL = "gemini-2.0-flash"
    # Gemini を Vertex AI 経由（ADC 認証＝アタッチ SA、無料クレジット適用）で呼ぶ。
    # project は computed_env の GOOGLE_CLOUD_PROJECT、認証は run SA の roles/aiplatform.user。
    GOOGLE_GENAI_USE_VERTEXAI = "true"
    GOOGLE_CLOUD_LOCATION     = "global"
    RABBITMQ_PORT             = "5672"
    RABBITMQ_USER             = "guest"
    RABBITMQ_PASS             = "guest"
    RABBITMQ_VHOST            = "/"
    EXCHANGE_NAME             = "ec-domain-events"
    DEMO_ENABLED              = "false"
  }
}

variable "secret_env" {
  type = list(object({
    name   = string
    secret = string
  }))
  description = "Secret Manager から注入する env"
  default = [
    { name = "INGEST_TOKEN", secret = "INGEST_TOKEN" },
  ]
}

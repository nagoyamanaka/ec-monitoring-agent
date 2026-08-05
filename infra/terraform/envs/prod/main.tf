locals {
  ar_host          = "${var.region}-docker.pkg.dev"
  image_ec         = coalesce(var.image_ec, "${local.ar_host}/${var.project_id}/${var.artifact_repo_id}/ec-backend:latest")
  image_backoffice = coalesce(var.image_backoffice, "${local.ar_host}/${var.project_id}/${var.artifact_repo_id}/backoffice-backend:latest")
  # 初回 apply 時は AR にイメージが存在しないため nginx:alpine をフォールバックに使用。
  # 実イメージは CI（build-push-frontend）が push 後に `gcloud run services update` で差し替える。
  image_frontend = coalesce(var.image_frontend, "nginx:alpine")
}

# API 有効化 / Artifact Registry / deploy bucket / Secret 箱
module "bootstrap" {
  source             = "../../modules/bootstrap"
  project_id         = var.project_id
  region             = var.region
  artifact_repo_id   = var.artifact_repo_id
  deploy_bucket_name = var.deploy_bucket_name
}

# VPC / subnet / Serverless VPC Access connector / firewall
module "networking" {
  source     = "../../modules/networking"
  project_id = var.project_id
  region     = var.region
}

# GitHub Actions 用 WIF + deployer SA
module "iam" {
  source            = "../../modules/iam"
  project_id        = var.project_id
  github_repository = var.github_repository

  depends_on = [module.bootstrap]
}

# 常駐 backbone（RabbitMQ/Mongo/ES/Valkey + worker）
module "gce_backbone" {
  source             = "../../modules/gce-backbone"
  project_id         = var.project_id
  region             = var.region
  zone               = var.zone
  subnet_id          = module.networking.subnet_id
  artifact_host      = local.ar_host
  gcs_compose_bucket = module.bootstrap.deploy_bucket
  image_ec           = local.image_ec
  image_backoffice   = local.image_backoffice

  # コスト最適化: RabbitMQ+Mongo+ES+Valkey+worker 同居 VM を e2-standard-2 → e2-small に縮小。
  # ただしメモリ/接続を捌けず DB 接続枯渇の再来リスクがあるため、Kizashi はこの未適用 plan を
  # 予兆（FUTURE_CHANGE）として検出し「apply 前に先手を」と予報する。デモ証拠 PR 専用・DO NOT MERGE。
  machine_type = "e2-small"

  depends_on = [module.bootstrap]
}

# 配信エッジ（クエリ/SSE）
module "cloud_run" {
  source               = "../../modules/cloud-run"
  project_id           = var.project_id
  region               = var.region
  image                = local.image_backoffice
  vpc_connector_id     = module.networking.connector_id
  backbone_internal_ip = module.gce_backbone.internal_ip
  # edge は ROLE=edge（consumer を張らない）＋ Valkey Pub/Sub fan-out なので構造上は scale-to-zero 可。
  # ただしハッカソン審査中は「開いた瞬間の初動（SSE 初回接続はここで終端）」を守るため min=1 で暖機。
  # 加えて予兆（Forecast）の RiskForecastRepository は InMemory＝プロセス内保持なので、scale-to-zero
  # すると生成済み予報が揮発する。審査後にコスト最適化へ戻すなら 0 に戻す。
  min_instances = 1
  # max=1 は審査中の一貫性担保: 予報（InMemoryRiskForecastRepository）は instance ローカルなので、
  # 2台に散ると「生成した人には見える/別 instance に当たった人には未生成」の split-brain になる。
  # demo reset の効きも1台なら全員に予測どおり。審査後にスケール戻すなら 0/2 へ。
  max_instances = 1

  # 予兆ブリーフィングは /forecast ルート＝edge（role!=worker）で提供される。FORECAST_ENABLED を
  # 付けないと forecastGuard が 404（docker-compose.prod.yml は GCE worker にしか設定しておらず、
  # worker はこのルートを持たないため本番で 404 になっていた）。GET 閲覧はこのフラグで開く。
  # DEMO_ENABLED: ハッカソン審査＝本番で予報生成（POST /forecast は demoGuard）とデモ卓を使うため
  # 公開エッジで true。審査用途に限定した意図的な露出（審査後は false へ）。
  plain_env = {
    FORECAST_ENABLED = "true"
    FORECAST_HORIZON = "今週末"
    DEMO_ENABLED     = "true"
    # 予報生成（POST /forecast）の Gemini は edge プロセス内で呼ぶ。このフラグが無いと
    # GeminiLLMClient が GEMINI_API_KEY=""（未設定）で AI Studio 経路に落ち、403
    # PERMISSION_DENIED → fallback 空予報になる（worker は compose.prod で true 済み）。
    # 認証は edge SA の ADC（roles/aiplatform.user 付与済み）。
    GOOGLE_GENAI_USE_VERTEXAI = "true"
    GOOGLE_CLOUD_LOCATION     = "asia-northeast1"
    # 予兆の FUTURE_CHANGE シグナル源（PullRequestSignalSource）は edge プロセス内で
    # GitHubGatewayImpl.listOpenPullRequests() を呼ぶ。token/repo が未設定だと即 [] を返し、
    # 「未マージ PR」の引用（[draft] chore(db)… ＋証拠リンク）が本番だけ消える（worker には
    # docker-compose.prod.yml で設定済みだが、/forecast は worker には無く edge が生成する）。
    # REPO/REF は非シークレットなので plain_env、TOKEN は secret_env（下）で Secret Manager から供給。
    GITHUB_TARGET_REPO = "nagoyamanaka/ec-monitoring-agent"
    GITHUB_TARGET_REF  = "demo/regression"
  }

  # INGEST_TOKEN（module 既定）に加え、GITHUB_TOKEN を Secret Manager から注入する。
  # secret_env を明示すると module の default（INGEST_TOKEN のみ）を上書きするため両方を列挙する。
  # GITHUB_TOKEN シークレットは bootstrap が作成済み・edge run SA は secretAccessor 付与済み。
  secret_env = [
    { name = "INGEST_TOKEN", secret = "INGEST_TOKEN" },
    { name = "GITHUB_TOKEN", secret = "GITHUB_TOKEN" },
  ]

  depends_on = [module.bootstrap]
}

# フロントエンド（nginx static + API リバースプロキシ）
module "cloud_run_frontend" {
  source           = "../../modules/cloud-run-frontend"
  project_id       = var.project_id
  region           = var.region
  image            = local.image_frontend
  backend_edge_url = module.cloud_run.service_uri
  # 審査員が最初に踏む nginx。edge と揃えて審査中は min=1 で暖機（コールドスタート除去）。
  # 審査後にコスト最適化へ戻すなら 0 に戻す。
  min_instances = 1

  depends_on = [module.bootstrap, module.cloud_run]
}

# Cloud Monitoring webhook チャネル + サンプル Alerting Policy
# ログベースメトリクス（FATAL メトリクスを monitoring の alert policy が参照するため先に定義）
module "logging" {
  source     = "../../modules/logging"
  project_id = var.project_id

  depends_on = [module.bootstrap]
}

# webhook チャネルの auth_token を edge の INGEST_TOKEN と一致させるため、
# 平文は tf に置かず Secret Manager（唯一の真実）から apply 時に読む。
# deployer SA は roles/secretmanager.admin を持つのでアクセス可（新規付与不要）。
data "google_secret_manager_secret_version" "ingest_token" {
  project = var.project_id
  secret  = "INGEST_TOKEN"

  depends_on = [module.bootstrap]
}

module "monitoring" {
  source                 = "../../modules/monitoring"
  project_id             = var.project_id
  ingest_webhook_url     = "${module.cloud_run.service_uri}/ingest/cloud-monitoring"
  ingest_token           = data.google_secret_manager_secret_version.ingest_token.secret_data
  cloud_run_service_name = module.cloud_run.service_name
  critical_log_metric    = module.logging.critical_log_metric

  depends_on = [module.bootstrap]
}

# GCE backbone SA に deploy bucket へのアクセス権限を付与
resource "google_storage_bucket_iam_member" "backbone_deploy_reader" {
  bucket = module.bootstrap.deploy_bucket
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${module.gce_backbone.vm_sa_email}"
}

# infra/terraform

ec-monitoring-agent の GCP インフラ（IaC）。設計は [docs/step4-1-strategy.md §11](../../docs/step4-1-strategy.md) を参照。

トポロジ（§11.1）: **ハイブリッド**。
- **GCE backbone**（常駐の脳）= RabbitMQ / MongoDB / Elasticsearch / Valkey / EDA worker。`docker-compose.prod.yml` を VM 上で起動。
- **Cloud Run edge**（配信エッジ）= クエリ/SSE をステートレスに。VPC connector 越しに backbone の Valkey/Mongo/ES へ到達。
- **Cloud Monitoring** → Webhook 通知チャネル → Cloud Run `/ingest/cloud-monitoring`（§11.2・Cloud Function は挟まない）。

## 構成

```
infra/terraform/
├── modules/
│   ├── bootstrap/     # API有効化 + Artifact Registry + deploy bucket + Secret 箱
│   ├── networking/    # VPC / subnet / VPC Access connector / firewall
│   ├── iam/           # WIF(GitHub OIDC) + deployer SA
│   ├── gce-backbone/  # 常駐VM（startup-scriptでcompose起動）
│   ├── cloud-run/     # 配信エッジ
│   ├── monitoring/    # webhook通知チャネル + サンプルAlertingPolicy
│   └── logging/       # ログベースメトリクス
└── envs/prod/         # 上記modulesの配線（root module）
```

## 前提（一度だけ手で）

1. **tfstate 用 GCS バケットを作る**（backend より先・ニワトリ卵回避）:
   ```bash
   gcloud storage buckets create gs://<TFSTATE_BUCKET> --location=asia-northeast1 --uniform-bucket-level-access
   ```
2. `envs/prod/backend.hcl.example` → `backend.hcl` にコピーし `bucket` を埋める。
3. `envs/prod/terraform.tfvars.example` → `terraform.tfvars` にコピーし `project_id` / `github_repository` / `deploy_bucket_name` を埋める。

## apply

```bash
cd infra/terraform/envs/prod
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

## apply 後にやること（値の注入・資材アップロード）

1. **Secret の値を投入**（tf には平文を置かない）:
   ```bash
   printf '%s' "<gemini-api-key>" | gcloud secrets versions add GEMINI_API_KEY  --data-file=-
   printf '%s' "<ingest-token>"   | gcloud secrets versions add INGEST_TOKEN    --data-file=-
   ```
2. **イメージを Artifact Registry に push**（`terraform output artifact_repo` のパスへ `ec-backend` / `backoffice-backend`）。
3. **compose を deploy bucket にアップロード**（GCE startup-script が pull する）:
   ```bash
   gcloud storage cp docker-compose.prod.yml gs://$(terraform output -raw deploy_bucket)/docker-compose.prod.yml
   ```
   - GCE startup は `IMAGE_EC` / `IMAGE_BACKOFFICE` / `GCP_PROJECT_ID` を `.env` で渡す。compose 側で `image: ${IMAGE_EC}` 等を参照するか、build を image 参照に置き換える運用に寄せる。
4. **GitHub Actions に WIF を設定**: `terraform output workload_identity_provider` と `deployer_sa_email` を repo の Variables（`WIF_PROVIDER` / `DEPLOYER_SA`）に登録（`.github/workflows/terraform.yml` 参照）。

## 既知の wiring 注意点（コード側の後続作業）

- **worker/edge のコード分離（§11.3）**: 現状アプリは backoffice が worker(EDA subscriber)+API の一体。Cloud Run edge は当面同一イメージを `min=max=1` 運用で「API+subscriber が両方動く」状態になる。SSE Pub/Sub（`RedisSSEAlertNotifier`）＋ read-model projection（`REDIS_URL` 利用）を実装して初めて多インスタンス・scale-to-zero の物語が成立する。`REDIS_URL` は compose/Cloud Run 両方に注入済み（アプリ未読込なら no-op）。
- **webhook トークン（§11.2）**: `webhook_tokenauth` は GCP がトークンを URL クエリに付与する。ingest コントローラは `x-ingest-token` ヘッダ前提なので、(a) `?token=` も受理するよう拡張するか、(b) `webhook_basicauth` に切替える。`INGEST_TOKEN` の値を合わせること。
- **ES メモリ**: backbone は `e2-standard-2`(8GB)。ES heap は compose で `-Xms512m -Xmx512m`。逼迫するなら `gce-backbone` の `machine_type` を `e2-standard-4` に上げる（無料クレジット内）。

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
   printf '%s' "<ingest-token>" | gcloud secrets versions add INGEST_TOKEN --data-file=-
   ```

   - **Gemini は API キー不要**。Vertex AI 経由（`GOOGLE_GENAI_USE_VERTEXAI=true`）で呼び、認証は Cloud Run / GCE の SA（`roles/aiplatform.user` 付与済み）＝ADC。課金は GCP プロジェクト（＝$300 無料クレジット）に乗る。`GEMINI_API_KEY` Secret は作らない（AI Studio フォールバックを使う場合のみ手動で追加）。
   - モデルのリージョンは `GOOGLE_CLOUD_LOCATION`（config.ts 既定 `global` / compose は `asia-northeast1` に固定）。変えたい場合は compose か `.env` で上書き。

   - **GITHUB_TOKEN（AI 調査のコミット収集＋証拠リンク＋修正PR起票）**。read-only の fine-grained PAT（対象 repo の Contents: Read、修正PRを実起票するなら Pull requests: Write）を投入する。secret 箱は `bootstrap` の `secret_ids` で作成済み。**平文は絶対に git / tfvars に置かない**（INGEST_TOKEN と同じ扱い）:

     ```bash
     printf '%s' "<github-pat>" | gcloud secrets versions add GITHUB_TOKEN --data-file=- --project=<PROJECT_ID>
     ```

     - **未投入でも起動は止まらない**（startup-script は取得失敗を空にフォールバックし、`GitHubGatewayImpl` は空トークンなら silent skip）。ただし空だとコミットの収集・証拠リンクは出ない。
     - **反映タイミング**: `.env` は GCE の startup-script が VM 起動時に書く。稼働中 VM には自動反映されないので、投入後に **(a) VM を reset/再作成** するか、**(b) 暫定で `/opt/app/.env` を手編集**して `docker compose --env-file /opt/app/.env -f docker-compose.base.yml -f docker-compose.prod.yml up -d backoffice-backend` で再起動する。
     - PAT を露出・誤コミットした場合は **GitHub 側で即 revoke → 再発行 → この version 追加をやり直す**（Secret Manager の旧 version も `gcloud secrets versions destroy` で破棄）。

2. **イメージを Artifact Registry に push**（`terraform output artifact_repo` のパスへ `ec-backend` / `backoffice-backend`）。
3. **compose を deploy bucket にアップロード**（GCE startup-script が pull する）:

   ```bash
   gcloud storage cp docker-compose.prod.yml gs://$(terraform output -raw deploy_bucket)/docker-compose.prod.yml
   ```

   - GCE startup は `IMAGE_EC` / `IMAGE_BACKOFFICE` / `GCP_PROJECT_ID` を `.env` で渡す。compose 側で `image: ${IMAGE_EC}` 等を参照するか、build を image 参照に置き換える運用に寄せる。

4. **GitHub Actions に WIF を設定**: `terraform output workload_identity_provider` と `deployer_sa_email` を repo の Variables（`WIF_PROVIDER` / `DEPLOYER_SA`）に登録（`.github/workflows/terraform.yml` 参照）。

   AI リメディエーション（`ai-remediation.yml`）を回すなら追加で:

   | 種別 | 名前 | 値 |
   | --- | --- | --- |
   | Variables | `REMEDIATION_SA` | `terraform output remediation_sa_email`（`roles/aiplatform.user` のみの専用 SA。**`DEPLOYER_SA` を使い回さない**——LLM が書いたコードを走らせるランナーにデプロイ権限は要らない） |
   | Variables | `GOOGLE_CLOUD_LOCATION` | 任意（未設定なら `global`）。Vertex AI のリージョン |
   | Secrets | `INGEST_URL` | backend の ingest ベース URL。結果 callback（`/ingest/remediation-result`）の宛先で、**未設定だとジョブが失敗する**（届かない確定を緑にしないため。旧 `BACKOFFICE_INGEST_URL` は廃止） |
   | Secrets | `INGEST_TOKEN` | `x-ingest-token`（`app.yml` / `terraform.yml` と共用） |

   `GEMINI_API_KEY` Secret は**不要**（2026-08-04 に WIF ＋ Vertex AI へ寄せた。secret が1本減り、認証・モデル・課金先が backend と揃う）。

## デプロイフロー

Terraform はインフラ（サービス設定・IAM・スケーリング）を管理し、**コンテナイメージの更新は CI または手動コマンドが担う**。

| サービス            | ランタイム                     | イメージ名            | CI ジョブ                               |
| ------------------- | ------------------------------ | --------------------- | --------------------------------------- |
| ec-backend          | GCE backbone（docker compose） | `ec-backend`          | ※ CI 未整備・手動                       |
| backoffice-backend  | GCE backbone + Cloud Run edge  | `backoffice-backend`  | ※ CI 未整備・手動                       |
| backoffice-frontend | Cloud Run（nginx）             | `backoffice-frontend` | `build-push-frontend`（main push 自動） |

**初回 `terraform apply` にイメージは不要**（frontend は `nginx:alpine` プレースホルダで起動、backbone はイメージプッシュ後に compose pull）。

### 手動デプロイ（CI がない / 緊急時）

[`manual_deploy.sh`](manual_deploy.sh) を使う。repo ルートからでも `infra/terraform/` からでも実行できる。
デプロイ後は AR の untagged イメージを自動削除する。

```bash
# 単一サービス
infra/terraform/manual_deploy.sh backoffice-frontend

# 全サービス
infra/terraform/manual_deploy.sh all
```

引数: `ec-backend` | `backoffice-backend` | `backoffice-frontend` | `all`

## サービス停止・コスト 0 にする手順

ハッカソン終了後など、GCP 課金を完全に止めたいときの手順。

### 1. インフラ削除（terraform destroy）

```bash
infra/terraform/teardown.sh
```

`teardown.sh` が `envs/prod` に対して `terraform init` → `terraform destroy` を実行する。  
以下のリソースが **すべて削除**される:

| リソース                            | 備考                                           |
| ----------------------------------- | ---------------------------------------------- |
| GCE VM (ec-monitoring-backbone)     | MongoDB / RabbitMQ / ES / Valkey ごと消える    |
| Cloud Run 2 サービス                | backoffice-backend edge / backoffice-frontend  |
| VPC / subnet / VPC Access connector |                                                |
| Artifact Registry リポジトリ        | push 済みイメージも一緒に消える                |
| GCS deploy バケット                 | `force_destroy=true` のため中身ごと削除        |
| Secret Manager secrets              | `INGEST_TOKEN` / `GITHUB_TOKEN` バージョンも含めて削除 |
| Monitoring / Logging リソース       | アラートポリシー・通知チャネル・ログメトリクス |

### 2. tfstate 用 GCS バケットを手動削除

`terraform destroy` はバックエンド自身（tfstate バケット）を管理できないため、別途削除する。  
バケット名は `envs/prod/backend.hcl` の `bucket =` を確認。

```bash
gcloud storage rm -r gs://<TFSTATE_BUCKET>
```

### 3. 手動追加 Secret の確認（条件付き）

`INGEST_TOKEN` 以外の Secret（例: `GEMINI_API_KEY`）を手動で追加していた場合は Terraform 管理外のため残る。

```bash
gcloud secrets list --project=ec-monitoring-agent
# 残っていれば個別削除
gcloud secrets delete <SECRET_ID> --project=ec-monitoring-agent
```

> **注意**: Vertex AI 経由の Gemini 利用（`GOOGLE_GENAI_USE_VERTEXAI=true`）は SA の ADC 認証なので `GEMINI_API_KEY` Secret は通常不要。

### 再構築するには

```bash
cd infra/terraform/envs/prod
terraform init -backend-config=backend.hcl
terraform apply
```

その後「apply 後にやること」セクションの手順を再実施する。

---

## 既知の wiring 注意点（コード側の後続作業）

- **worker/edge のコード分離（§11.3）**: 現状アプリは backoffice が worker(EDA subscriber)+API の一体。Cloud Run edge は当面同一イメージを `min=max=1` 運用で「API+subscriber が両方動く」状態になる。SSE Pub/Sub（`RedisSSEAlertNotifier`）＋ read-model projection（`REDIS_URL` 利用）を実装して初めて多インスタンス・scale-to-zero の物語が成立する。`REDIS_URL` は compose/Cloud Run 両方に注入済み（アプリ未読込なら no-op）。
- **webhook 認証（§11.2・解決済み）**: `webhook_tokenauth` の token は GCP 生成で固定できず（許可ラベルは `url` のみ）、edge の `INGEST_TOKEN` と一致させられない。そこで `webhook_basicauth` を採用し、`sensitive_labels.password` を Secret Manager の `INGEST_TOKEN` と同値に固定（monitoring モジュール）。GCP は `Authorization: Basic base64(username:password)` を送り、ingest コントローラが Basic のパスワードを `INGEST_TOKEN` と照合する（`x-ingest-token` ヘッダ経路＝CI も併存）。
- **ES メモリ**: backbone は `e2-standard-2`(8GB)。ES heap は compose で `-Xms512m -Xmx512m`。逼迫するなら `gce-backbone` の `machine_type` を `e2-standard-4` に上げる（無料クレジット内）。

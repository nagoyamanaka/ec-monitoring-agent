# Step 4-5 TODO: GCP 完結型デプロイ＆可観測性

> 対応設計: `docs/step4-5-backoffice-infra.md`
> 前提: step4-2 P0 / step4-3 P0・P1 が完了済み（アプリは動く）。本 TODO は **作成済みの IaC（`infra/terraform/`）を実機で動かす**残作業。
> **上から順に実行できるよう依存順に並べてある**。各タスクの `前提:` を満たしてから着手すること。
> 優先度: **P0=動かすライン必須** / **P1=可観測性の仕上げ** / **stretch=任意**。
> 移動元: #2=step4-3 stretchⅠ タスク20 / 検知正規化=step4-2 stretchⅠ タスク31・32（重複排除のため本 doc に集約）。

> 前提2: ルートでmake test-integraionで結合テストできるので、アプリケーション層をいじるなど、必要に応じて確認すること

---

## Phase 0: デプロイ前コード修正（実機に上げる前に必須）

### タスク T1: ingest コントローラの URL クエリトークン対応 〔P0〕

> 移動元: step4-3 stretchⅠ タスク20（本 doc に集約）。
> 前提: なし（純粋なコード修正・ローカルで完結）。**これが無いと Phase 1 の疎通が原理的に通らない**（§3.1）。

- 【修正】`src/apps/backoffice/backend/src/controllers/ingest/CloudMonitoringAlertIngestController.ts`：認証を `x-ingest-token` ヘッダ **または** `?token=` クエリのどちらか一致で通すよう拡張
  - 理由: Cloud Monitoring の `webhook_tokenauth`（`modules/monitoring/main.tf`）はトークンを URL クエリに付与する。`SecurityScanIngestPostController` 等はヘッダ前提のままで良い（CI が叩く側＝ヘッダ送出可能）
- 【テスト】`ingest.int.test.ts` に `?token=` 経路の受理／不一致 401 ケースを追加（既存ヘッダ経路は維持）
- 設計判断: トークン値は `INGEST_TOKEN`（既存 config）単一ソース。terraform の `secret_env` で Cloud Run に注入される値と一致させる（T6 で投入）

### タスク T2: docker-compose.prod.yml を image 参照化 〔P0〕

> 前提: T1 と独立。Artifact Registry のパスが必要（`terraform output artifact_repo`）だが、変数化しておけば apply 前に書ける。

- 【修正】`docker-compose.prod.yml`：`backoffice-backend` / `ec-backend` の `build:` を `image: ${IMAGE_BACKOFFICE}` / `image: ${IMAGE_EC}` 参照に置換
  - 理由: GCE backbone は startup-script で compose ファイルだけを deploy bucket から pull し、ビルド元ソースを持たない（§2 穴2）。`build:` のままだと VM 上で起動不能
  - `IMAGE_EC` / `IMAGE_BACKOFFICE` / `GCP_PROJECT_ID` は startup-script が `.env` で渡す（`infra/terraform/README.md` の「apply 後にやること」3 と整合）
- 【確認】`docker-compose.yml`（base）の `build:` はローカル用に残す。prod override 側だけ image 参照にする（base + prod の merge で image が build を上書きできるか要確認。できなければ prod 側で完結させる）

### タスク T3: cloud-run module の env / secret 配線補完 〔P0〕

> 前提: なし（terraform 編集のみ）。apply（T5）の前に埋める。

- 【確認/修正】`infra/terraform/modules/cloud-run/variables.tf` の `plain_env` 既定に **`GEMINI_MODEL`**（既定 `gemini-2.0-flash`）を追加。`DEMO_ENABLED` は既存
- 【確認】`secret_env` 既定（`GEMINI_API_KEY` / `INGEST_TOKEN`）は OK。値は T6 で投入
- 【確認】`computed_env`（MONGO/ES/REDIS/RABBITMQ ホスト）が backbone 内部 IP を指すこと（実装済み）。`ELASTICSEARCH_URL` / `REDIS_URL` は SimilarPatternRule / 将来 RedisSSE 用。**現状アプリは REDIS_URL 未読込なので no-op**（#3 着手まで害なし）
- 設計判断: 機密は `secret_env`（Secret Manager 参照）、非機密は `plain_env`。tf に平文を書かない原則を維持

---

## Phase 1: 初回デプロイ＆垂直疎通（#1）

### タスク T4: 手動前提（tfstate / tfvars / Secret 箱）〔P0〕

> 前提: GCP プロジェクトと課金有効化。`gcloud` 認証済み。
> 参照: `infra/terraform/README.md`「前提（一度だけ手で）」。

- tfstate 用 GCS バケット作成（backend より先・ニワトリ卵回避）:
  `gcloud storage buckets create gs://<TFSTATE_BUCKET> --location=asia-northeast1 --uniform-bucket-level-access`
- `envs/prod/backend.hcl.example` → `backend.hcl`（`bucket` 記入）
- `envs/prod/terraform.tfvars.example` → `terraform.tfvars`（`project_id` / `github_repository` / `deploy_bucket_name` 記入）

### タスク T5: terraform apply（初回構築）〔P0〕

> 前提: T2・T3・T4 完了。初回はローカル `terraform apply` で通すのが安全（CI 経由 apply は WIF 設定=T6 の後）。

- `cd infra/terraform/envs/prod && terraform init -backend-config=backend.hcl && terraform plan` で差分確認 → `terraform apply`
- ゴール（README 記載のリソースが立つ）: bootstrap（API有効化/AR/deploy bucket/Secret 箱）/ networking（VPC/connector/firewall）/ iam（WIF/deployer SA）/ gce-backbone（VM）/ cloud-run（edge）/ monitoring（webhook channel + 5xx policy）/ logging（log-based metric）
- 注意: **この時点では Cloud Run は起動失敗してよい**（イメージ未 push のため）。T6 で resolve する

### タスク T6: apply 後の値注入・資材アップロード 〔P0〕

> 前提: T5 完了。参照: README「apply 後にやること」。

- **Secret 投入**（tf に平文を置かない）:
  `printf '%s' "<gemini-api-key>" | gcloud secrets versions add GEMINI_API_KEY --data-file=-`
  `printf '%s' "<ingest-token>" | gcloud secrets versions add INGEST_TOKEN --data-file=-`
- **イメージ push**: `terraform output artifact_repo` のパスへ `ec-backend` / `backoffice-backend` を build & push（CI でも可）
- **compose アップロード**: `gcloud storage cp docker-compose.prod.yml gs://$(terraform output -raw deploy_bucket)/docker-compose.prod.yml`（GCE startup が pull）
- **WIF vars 登録**: `terraform output workload_identity_provider` / `deployer_sa_email` を GitHub repo Variables（`WIF_PROVIDER` / `DEPLOYER_SA`）＋ `TF_STATE_BUCKET` に登録 → 以降の apply は `terraform.yml` CI（main push + 承認ゲート）経由に移行できる
- **Cloud Run 暫定運用**: SSE 破綻回避のため `min_instances=max_instances=1` で apply（§3.2）。`infra/terraform/envs/prod` で `cloud_run` module に `min_instances=1 / max_instances=1` を渡す

### タスク T7: 検知正規化の実機検証（CloudMonitoringAlertTranslator）〔P0〕

> 移動元: step4-2 stretchⅠ タスク31（translator 本体・UT は実装済みなので**実機 payload での検証が残**）。
> 前提: T6 完了（Cloud Run 稼働）。

- 【検証】実際の Cloud Monitoring Alerting webhook payload（`incident.*`）で `CloudMonitoringAlertTranslator.toMonitoringEvent` が妥当な `category=INFRASTRUCTURE/CAPACITY` / `eventName` / `dedupKey` / `severity` を付けるか確認。closed 通知が `severity=info`（非 alertable）になること
- 【必要なら追記】実 payload を fixture 化して `CloudMonitoringAlertTranslator.test.ts` に入出力 UT を追加（GCP の実バージョン差分を吸収）
- これで以降のシナリオ4（インフラ起因）起点アラートが既存 `AnalyzeAlert → InvestigateAlert`（InfraInvestigation 証拠収集）に**合流するだけ**＝新規配線不要

### タスク T8: 垂直疎通テスト（監視 → ingest）〔P0〕

> 前提: T1・T6・T7 完了。**Phase 1 の DoD**（§5）。

- 手動 POST: `curl -XPOST 'https://<cloud-run>/ingest/cloud-monitoring?token=<INGEST_TOKEN>' -H 'content-type: application/json' -d '<incident サンプル JSON>'` → 202 受理を確認
- Mongo に Alert が保存され、`AnalyzeAlert`（既知/未知分類）が走ることを確認（Cloud Logging で `action` ログ追跡）
- 実発火経路: Cloud Monitoring の `cloud_run_5xx` サンプルポリシーを意図的に発火（5xx を出す）→ webhook channel → ingest 到達を確認
- ゴール: 「GCP の監視（Monitoring）→ アプリの受信（ingest）」ラインが繋がる

---

## Phase 2: エラーログ起点の自動発報（#4）

### タスク T9: FATAL ログベースメトリクス＋アラートポリシー 〔P1〕

> 前提: Phase 1 完了（疎通済みの ingest webhook を再利用）。terraform 編集中心。
> 既存 `modules/logging`（`alert_ingested` 計数メトリクス）/ `modules/monitoring`（webhook channel + 5xx policy）に**追記**する形。

- 【新規】`modules/logging/main.tf`：`severity=FATAL`（または特定例外クラス）を検知する log-based metric を追加
  - フィルタ例: `resource.type="cloud_run_revision" AND jsonPayload.severity="FATAL"`（アプリは `start.ts` の bootstrap 失敗等で `severity:"FATAL"` JSON を既に吐く）
  - GCE backbone 側のログも拾うなら `resource.type` を OR で追加（Ops Agent 経由）
- 【新規】`modules/monitoring/main.tf`：上記メトリクスを条件にした `google_monitoring_alert_policy` を追加し、`notification_channels` に既存 `ingest_webhook` を指定
- 【出力】logging module の outputs に metric 名を足し、monitoring module へ変数で渡す（module 間結線）
- 【テスト】アプリに意図的に FATAL ログを吐かせる→メトリクス増加→policy 発火→`/ingest/cloud-monitoring` 着弾、を確認（Phase 2 DoD）
- 設計判断: 「アプリのエラーログ→自動アラート」を GCP 内で完結。アプリ側の追加実装は不要（構造化ログは既存 `GcpCloudLoggingLogger` が出力済み）

---

## Phase 3: GCP ネイティブ可観測性の仕上げ（#5 / #6）

### タスク T10: Cloud Trace 書込権限の付与（cloudtrace.agent）〔P1〕

> 前提: Phase 1 完了。**トレースが出ない根本原因の修正**（§2 穴3）。terraform のみ。

- 【修正】`modules/cloud-run/main.tf` の `google_project_iam_member.run` の for_each に **`roles/cloudtrace.agent`** を追加
- 【修正】`modules/gce-backbone/main.tf` の `google_project_iam_member.vm` の for_each にも **`roles/cloudtrace.agent`** を追加（worker は GCE で動くため）
- 理由: 現状 SA は logWriter/metricWriter/aiplatform.user 止まりで、`start.ts` の Cloud Trace exporter が書き込めない

### タスク T11: OTel 自動計装の導入 〔P1〕

> 前提: T10（権限）。これでトレースに中身が入る。

- 【追加】`@opentelemetry/auto-instrumentations-node` を workspace root に追加
- 【修正】`src/apps/backoffice/backend/src/start.ts`：`NodeSDK` に `instrumentations: [getNodeAutoInstrumentations()]` を渡す（HTTP / Express / MongoDB / ioredis を自動計装）
- 【任意】ノイズの多い計装（fs 等）は無効化オプションで絞る
- 設計判断: exporter は既存。計装を足すだけで VPC connector 跨ぎの通信遅延・Mongo/Valkey レイテンシが Cloud Trace に出る

### タスク T12: Log-Trace 相関の動作確認（#6・実装済み）〔P1〕

> 前提: T10・T11。**実装は完了済み**（`GcpCloudLoggingLogger` が `logging.googleapis.com/trace`/`spanId` を注入）。確認のみ。

- Cloud Logging の任意エラーログをクリック→「関連トレース」で対応する Cloud Trace へ 1 クリックジャンプできることを確認（Phase 3 DoD）
- 出ない場合の切り分け: `GCP_PROJECT_ID` 環境変数が Cloud Run / GCE 両方に渡っているか（trace リソース名の projects/ 部分に必須）

---

## 別トラック（本ロードマップ外・順序整合のため明記）

### #3 worker/edge 分離・RedisSSEAlertNotifier・read-model

> **本 TODO では実装しない。** 正は **step4-3 stretchⅠ タスク16〜19**。
> **着手タイミング**: Phase 1 が動いた後、Cloud Run を `min=max=1` 暫定（§3.2）から **多インスタンス / scale-to-zero** にする時。それまでは単一インスタンスで in-process SSE のまま正しく動く。
> **前提依存**: これを入れるまで Cloud Run は `min=max=1` 固定（T6 参照）。`REDIS_URL` は compose/Cloud Run に注入済み・アプリ未読込で no-op なので、先にインフラだけ立っていても無害。
> compose の `valkey` サービス・`REDIS_URL`・`ELASTICSEARCH_URL` 注入（git changes 済み）はこのトラックの地ならし。

---

## stretch: 任意・次フェーズ

### タスク T13: CloudMonitoringGateway（pull・メトリクス相関）〔stretch〕

> 移動元: step4-2 stretchⅠ タスク32。前提: Phase 1〜3 着地後。
> webhook の push ingest（T7）とは別物＝**調査時の証拠 pull 側**。

- 【新規（任意）】`CloudMonitoringGateway`（CPU / 接続数 / 5xx 等メトリクスの相関取得）を `InfraInvestigationPort` 配下に追加。**読み取り専用**。生レスポンスは `InfraEvidence` に正規化してから AI に渡す
- 無くてもシナリオ4は Cloud Logging + Terraform + GitHub で成立

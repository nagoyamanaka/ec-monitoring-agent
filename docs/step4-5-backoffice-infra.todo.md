# Step 4-5 TODO: GCP 完結型デプロイ＆可観測性

> 対応設計: `docs/step4-5-backoffice-infra.md`
> 前提: step4-2 P0 / step4-3 P0・P1 が完了済み（アプリは動く）。本 TODO は **作成済みの IaC（`infra/terraform/`）を実機で動かす**残作業。
> **上から順に実行できるよう依存順に並べてある**。各タスクの `前提:` を満たしてから着手すること。
> 優先度: **P0=動かすライン必須** / **P1=可観測性の仕上げ** / **stretch=任意**。
> 移動元: #2=step4-3 stretchⅠ タスク20 / 検知正規化=step4-2 stretchⅠ タスク31・32（重複排除のため本 doc に集約）。

> 前提2: ルートでmake test-integraionで結合テストできるので、アプリケーション層をいじるなど、必要に応じて確認すること

---

## Phase 0: デプロイ前コード修正（実機に上げる前に必須）

### タスク T1: ingest コントローラの URL クエリトークン対応 〔P0〕✅

> 移動元: step4-3 stretchⅠ タスク20（本 doc に集約）。
> 前提: なし（純粋なコード修正・ローカルで完結）。**これが無いと Phase 1 の疎通が原理的に通らない**（§3.1）。

- 【修正】`src/apps/backoffice/backend/src/controllers/ingest/CloudMonitoringAlertIngestController.ts`：認証を `x-ingest-token` ヘッダ **または** `?token=` クエリのどちらか一致で通すよう拡張
  - 理由: Cloud Monitoring の `webhook_tokenauth`（`modules/monitoring/main.tf`）はトークンを URL クエリに付与する。`SecurityScanIngestPostController` 等はヘッダ前提のままで良い（CI が叩く側＝ヘッダ送出可能）
- 【テスト】`ingest.int.test.ts` に `?token=` 経路の受理／不一致 401 ケースを追加（既存ヘッダ経路は維持）
- 設計判断: トークン値は `INGEST_TOKEN`（既存 config）単一ソース。terraform の `secret_env` で Cloud Run に注入される値と一致させる（T6 で投入）

### タスク T2: docker-compose.prod.yml を image 参照化 〔P0〕✅

> 前提: T1 と独立。Artifact Registry のパスが必要（`terraform output artifact_repo`）だが、変数化しておけば apply 前に書ける。

- 【修正】`docker-compose.prod.yml`：`backoffice-backend` / `ec-backend` の `build:` を `image: ${IMAGE_BACKOFFICE}` / `image: ${IMAGE_EC}` 参照に置換
  - 理由: GCE backbone は startup-script で compose ファイルだけを deploy bucket から pull し、ビルド元ソースを持たない（§2 穴2）。`build:` のままだと VM 上で起動不能
  - `IMAGE_EC` / `IMAGE_BACKOFFICE` / `GCP_PROJECT_ID` は startup-script が `.env` で渡す（`infra/terraform/README.md` の「apply 後にやること」3 と整合）
- 【確認】`docker-compose.yml`（base）の `build:` はローカル用に残す。prod override 側だけ image 参照にする（base + prod の merge で image が build を上書きできるか要確認。できなければ prod 側で完結させる）

### タスク T3: cloud-run module の env / secret 配線補完 〔P0〕✅

> 前提: なし（terraform 編集のみ）。apply（T5）の前に埋める。

- 【確認/修正】`infra/terraform/modules/cloud-run/variables.tf` の `plain_env` 既定に **`GEMINI_MODEL`**（既定 `gemini-2.5-pro`）を追加。`DEMO_ENABLED` は既存
- 【確認】`secret_env` 既定（`GEMINI_API_KEY` / `INGEST_TOKEN`）は OK。値は T6 で投入
- 【確認】`computed_env`（MONGO/ES/REDIS/RABBITMQ ホスト）が backbone 内部 IP を指すこと（実装済み）。`ELASTICSEARCH_URL` / `REDIS_URL` は SimilarPatternRule / 将来 RedisSSE 用。**現状アプリは REDIS_URL 未読込なので no-op**（#3 着手まで害なし）
- 設計判断: 機密は `secret_env`（Secret Manager 参照）、非機密は `plain_env`。tf に平文を書かない原則を維持

---

## Phase 1: 初回デプロイ＆垂直疎通（#1）✅

### タスク T4: 手動前提（tfstate / tfvars / Secret 箱）〔P0〕

> 前提: GCP プロジェクトと課金有効化。`gcloud` 認証済み。
> 参照: `infra/terraform/README.md`「前提（一度だけ手で）」。

- tfstate 用 GCS バケット作成（backend より先・ニワトリ卵回避）:
  `gcloud storage buckets create gs://<TFSTATE_BUCKET> --location=asia-northeast1 --uniform-bucket-level-access`
- `envs/prod/backend.hcl.example` → `backend.hcl`（`bucket` 記入）
- `envs/prod/terraform.tfvars.example` → `terraform.tfvars`（`project_id` / `github_repository` / `deploy_bucket_name` 記入）

### タスク T5: terraform apply（初回構築）〔P0〕✅

> 前提: T2・T3・T4 完了。初回はローカル `terraform apply` で通すのが安全（CI 経由 apply は WIF 設定=T6 の後）。

- `cd infra/terraform/envs/prod && terraform init -backend-config=backend.hcl && terraform plan` で差分確認 → `terraform apply`
- ローカル検証メモ: sudo snap install terraform --classic でterraformをインストール
- ゴール（README 記載のリソースが立つ）: bootstrap（API有効化/AR/deploy bucket/Secret 箱）/ networking（VPC/connector/firewall）/ iam（WIF/deployer SA）/ gce-backbone（VM）/ cloud-run（edge）/ monitoring（webhook channel + 5xx policy）/ logging（log-based metric）
- 注意: **この時点では Cloud Run は起動失敗してよい**（イメージ未 push のため）。T6 で resolve する

### タスク T6: apply 後の値注入・資材アップロード 〔P0〕　✅

> 前提: T5 完了。参照: README「apply 後にやること」。

- **Secret 投入**（tf に平文を置かない）:
  `printf '%s' "<gemini-api-key>" | gcloud secrets versions add GEMINI_API_KEY --data-file=-`
  `printf '%s' "<ingest-token>" | gcloud secrets versions add INGEST_TOKEN --data-file=-`
- **イメージ push**: `terraform output artifact_repo` のパスへ `ec-backend` / `backoffice-backend` を build & push（CI でも可）
- **compose アップロード**: `gcloud storage cp docker-compose.prod.yml gs://$(terraform output -raw deploy_bucket)/docker-compose.prod.yml`（GCE startup が pull）
- **WIF vars 登録**: `terraform output workload_identity_provider` / `deployer_sa_email` を GitHub repo Variables（`WIF_PROVIDER` / `DEPLOYER_SA`）＋ `TF_STATE_BUCKET` に登録 → 以降の apply は `terraform.yml` CI（main push + 承認ゲート）経由に移行できる
- **Cloud Run 暫定運用**: SSE 破綻回避のため `min_instances=max_instances=1` で apply（§3.2）。`infra/terraform/envs/prod` で `cloud_run` module に `min_instances=1 / max_instances=1` を渡す

### タスク T7: 検知正規化の実機検証（CloudMonitoringAlertTranslator）〔P0〕✅

> 移動元: step4-2 stretchⅠ タスク31（translator 本体・UT は実装済みなので**実機 payload での検証が残**）。
> 前提: T6 完了（Cloud Run 稼働）。

- 【検証】実際の Cloud Monitoring Alerting webhook payload（`incident.*`）で `CloudMonitoringAlertTranslator.toMonitoringEvent` が妥当な `category=INFRASTRUCTURE/CAPACITY` / `eventName` / `dedupKey` / `severity` を付けるか確認。closed 通知が `severity=info`（非 alertable）になること
- 【必要なら追記】実 payload を fixture 化して `CloudMonitoringAlertTranslator.test.ts` に入出力 UT を追加（GCP の実バージョン差分を吸収）
- これで以降のシナリオ4（インフラ起因）起点アラートが既存 `AnalyzeAlert → InvestigateAlert`（InfraInvestigation 証拠収集）に**合流するだけ**＝新規配線不要

### タスク T8: 垂直疎通テスト（監視 → ingest）〔P0〕✅

> 前提: T1・T6・T7 完了。**Phase 1 の DoD**（§5）。

- 手動 POST: `curl -XPOST 'https://<cloud-run>/ingest/cloud-monitoring?token=<INGEST_TOKEN>' -H 'content-type: application/json' -d '<incident サンプル JSON>'` → 202 受理を確認
- Mongo に Alert が保存され、`AnalyzeAlert`（既知/未知分類）が走ることを確認（Cloud Logging で `action` ログ追跡）
- 実発火経路: Cloud Monitoring の `cloud_run_5xx` サンプルポリシーを意図的に発火（5xx を出す）→ webhook channel → ingest 到達を確認
- ゴール: 「GCP の監視（Monitoring）→ アプリの受信（ingest）」ラインが繋がる

---

## Phase 1.5: フロントエンドのデプロイ（ハッカソン発表に必須）

> 背景: backend（Cloud Run edge）と GCE backbone までは上がっているが、**`src/apps/backoffice/frontend` は本番デプロイ先が無い**。
> `frontend/Dockerfile` は `dev` ステージ（`vite dev` + volume mount）しか無く、prod 用の static build/serve ステージが無い。`docker-compose.prod.yml` にも frontend サービスが無く、terraform にも hosting リソースが無い。
> **このままだと審査員が触れる URL が出せない**＝デモ不能。Phase 1 の疎通が通った直後にここを埋める。
> 重要な制約: アラート一覧は **SSE（EventSource）**で流れる。SSE はクロスオリジンだと CORS/credentials が面倒なので、**ブラウザから見て frontend と API を同一オリジンにする**のが最優先（ローカルの vite proxy と同じ構図を本番でも作る）。

> **採用方式: 方式A（nginx static + リバースプロキシを独立 Cloud Run サービス）に決定。**
> ローカルの `vite.config.ts` proxy と同型で、ブラウザは frontend オリジンのみと通信＝SSE 同一オリジン。frontend と backend(edge) を別 Cloud Run サービスとして関心分離する。

### タスク T8.6: frontend Dockerfile に prod（nginx）ステージ追加 〔P0〕✅

> 前提: Phase 1（backend が Cloud Run で稼働・URL 確定）。

- `frontend/Dockerfile` に `build`（既存 deps を流用し `pnpm run build`→`dist`）→ `runner`（`nginx:alpine` に `dist` と `nginx.conf` を COPY）ステージを追加
- `nginx.conf`：
  - `location / { try_files $uri /index.html; }`（SPA fallback）
  - `location ~ ^/(alerts|analytics|demo|patterns|forecast|health) { proxy_pass <BACKEND_EDGE_URL>; }`（`vite.config.ts` の proxy 対象と一致させる）
  - **SSE 用に `/alerts/stream` 系には `proxy_buffering off;` と `proxy_read_timeout` を長め**に（EventSource が途切れない）
  - backend URL はビルド時固定でなく **起動時 env**（`envsubst` で nginx.conf に注入）にして、Cloud Run の env で差し替えられるようにする
- 【確認】frontend は相対パスのまま（`FetchHttpClient` の baseURL 空・現状維持）。`VITE_` の埋め込み URL は不要（同一オリジン proxy 前提）

### タスク T8.7: frontend のデプロイ結線（terraform / CI） 〔P0〕✅ 実装済み

> 前提: T8.6。

- `modules/cloud-run` を service 名でパラメータ化し、frontend 用にもう1サービスを定義（public・SSE は backend 側が張るので frontend は **scale-to-zero 可**＝`min=max=1` 不要）。env に backend(edge) URL を渡す
- 【CI】`.github/workflows` に frontend イメージ（nginx ステージ）の build & push を追加
- 【DoD】審査員に渡せる **frontend 公開 URL** にアクセス→アラート一覧が表示され、DEMO_ENABLED 時は fault injection ボタンで SSE 経由のライブ更新が見える

---

## Phase 2: エラーログ起点の自動発報（#4）

### タスク T9: CRITICAL ログベースメトリクス＋アラートポリシー 〔P1〕✅ 実装済み（実機検証残）

> 前提: Phase 1 完了（疎通済みの ingest webhook を再利用）。terraform 編集中心。
> 既存 `modules/logging`（`alert_ingested` 計数メトリクス）/ `modules/monitoring`（webhook channel + 5xx policy）に**追記**する形。

- 【済】severity 語彙を Cloud Logging に正規化（GCP を正・二重 enum 排除）: `StructuredLog` の `WARN→WARNING` / `FATAL→CRITICAL`、`Logger.fatal()→critical()`（呼び出しは start.ts 2箇所のみ）・`OTelLogger`/`ConsoleLogger` の console 振り分け・`start.ts` の bootstrap も追従。AppLogEntry / AlertSeverities が既に WARNING/CRITICAL なので全層一致。これで GCP が severity を標準 enum として昇格できる
- 【済】`modules/logging/main.tf`：`google_logging_metric.critical_log`（`ec_monitoring_critical_log`）を追加
  - フィルタ: `(resource.type="cloud_run_revision" OR resource.type="gce_instance") AND severity>="CRITICAL"`
  - Cloud Run（edge）と GCE backbone（worker・Ops Agent 経由）の両方を拾う。CRITICAL は標準 LogSeverity なので jsonPayload を覗くハック不要＝素直な severity フィルタで成立
- 【済】`modules/monitoring/main.tf`：`google_monitoring_alert_policy.critical_log` を追加（条件＝当該 metric > 0、`notification_channels` に既存 `ingest_webhook`）
- 【済】`modules/logging/outputs.tf` に `critical_log_metric` 出力を追加→ `envs/prod/main.tf` で `module.monitoring.critical_log_metric` へ結線（logging を monitoring より先に定義）
- 【残】実機検証: アプリに意図的に CRITICAL ログを吐かせる→メトリクス増加→policy 発火→`/ingest/cloud-monitoring` 着弾（Phase 2 DoD）
- 設計判断: 「アプリのエラーログ→自動アラート」を GCP 内で完結。アプリ側の追加実装は不要（構造化ログは既存 `GcpCloudLoggingLogger` が出力済み）

#### おまけ: CloudLoggingGateway 実装（スタブ→実 API）✅ 実装済み

> 背景: `CloudLoggingGatewayImpl` は空配列を返すスタブだった（AI 調査時のアプリログ証拠収集が常に空）。T9 で CRITICAL→アラートの自動発報を入れる流れに合わせ、調査側の証拠 pull も実装。

- 【済】`CloudLoggingGatewayImpl`：`@google-cloud/logging` を **dynamic import**（ローカル/テスト経路では読み込まない）で `severity>=WARNING` を時間窓フィルタ取得→`AppLogEntry` に正規化（severity 丸め・jsonPayload.message 抽出・resource ラベル）
- 【済】ローカル ⇄ 実環境のモック切替は **env 駆動**（既存 gateway 群と同型）:
  - `GCP_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` 未設定 → `[]`（＝ローカル既定。GCP 認証不要で従来どおり動く）
  - `CLOUD_LOGGING_ENABLED=false` → project があっても明示的に無効化
  - project あり ＆ 無効化なし → 実 API（worker は GCE 常駐で ADC が効く）
- 【済】terraform: gce-backbone SA に `roles/logging.viewer` を追加（worker がログを読むため）。worker は `docker-compose.prod.yml` で `GCP_PROJECT_ID` 注入済み＝デプロイ時に自動で実 API へ切替
- 【テスト】`CloudLoggingGatewayImpl.test.ts`：project 空/`enabled=false` で no-op、フィルタ組み立て、LogEntry→AppLogEntry 正規化（fake クライアント注入で UT）

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

## 信頼性バグ: RabbitMQ 切断後に自動再接続しない 〔P0〕✅ 修正済み

> 発見経緯: ローカルで fault injection ボタンを押してもアラートが増えない現象を調査。RabbitMQ が（再起動等で）一度切断されると、`RabbitMqConnection` に再接続ロジックが無いため **アプリは永久に未接続のまま**になっていた。
> 症状: `rabbitmqctl list_consumers` が 0・`list_connections` が空。EC の publish は `DomainEventFailoverPublisher` 経由で Mongo `DomainEvents` コレクションに退避され**例外を投げない**ため、`place_order_payment_failed` ログは出るのに backoffice 側が一切 consume せず、新規 Alert が生成されない（Mongo `ec.DomainEvents` に 62 件の未配信イベントが滞留していた）。
> **これは Cloud Run / scale-to-zero でさらに悪化する**（インスタンス入れ替えのたびに購読が死ぬ）＝ Q3「subscriber を Cloud Run に置くのは筋が悪い」の実証。worker は GCE 常駐が正しい（`docker-compose.prod.yml` の方針通り）。

- 【済】`src/Contexts/Shared/infrastructure/EventBus/RabbitMq/RabbitMqConnection.ts`：`connection.on("close")` で切断検知→**指数バックオフ（1s→最大30s）で再接続**→ `onReestablished` フックで exchange/queue 再宣言＋consumer 再登録。`stop()` 由来の意図的クローズは `closing` フラグで除外。`on("error")` は握り潰しをやめ WARN ログ化
- 【済】`EcBackendApp` / `BackofficeApp`：`connection.onReestablished(() => configureEventBus(...))` を登録。再接続時に新しい channel へ購読を張り直す（張り直さないと購読が永久停止する）
- 【検証済】RabbitMQ コンテナのみ再起動 → アプリは再起動せず ~15s（4 回目の試行）で自動復旧し consumer=2 に回復、その後 fault injection で alert が 5→6 に増加。`pnpm typecheck` / `pnpm test`（533 件）green
- 【残・任意】RabbitMQ を落とす→上げる→publish が backoffice に届く、の結合テスト自動化（`make test-integration`）

#### failover ドレイン（切断中の取りこぼしゼロ化）✅ 実装済み

**なぜ必要か（仕組みの解説）**:

- publish 時に RabbitMQ へ送れないと、`RabbitMQEventBus.publish` は例外を握って [`DomainEventFailoverPublisher`](../src/Contexts/Shared/infrastructure/EventBus/DomainEventFailoverPublisher/DomainEventFailoverPublisher.ts) 経由で **Mongo `DomainEvents` コレクションにイベントを退避**する（= イベント自体は消えない）。
- ところが**退避したものを後で読み出して再送するコードが無かった**（`consume()` は実装済みだが呼び出し側ゼロ）。結果、切断中に発生したイベントは Mongo に**永久に滞留**し、再接続後の新規イベントだけが流れる＝**切断ウィンドウ分のアラートが恒久的に欠落**していた（実際に 62 件滞留していた）。
- 「再接続」だけでは "今後" は直るが "切断中に取りこぼした分" は戻らない。これを戻すのが **ドレイン（drain＝退避分の再送）**。

**実装**:

- [`DomainEventFailoverPublisher`](../src/Contexts/Shared/infrastructure/EventBus/DomainEventFailoverPublisher/DomainEventFailoverPublisher.ts)：`pending()`（退避イベントを生のまま取得）＋ `remove(eventId)`（再送成功分を削除）を追加。
  - 設計上の罠: **deserialize は使わない**。退避するのは publish 側アプリで、その `DomainEventDeserializer` は自分が _subscribe_ するイベントしか知らない（例: EC は `ec.payment.timeout` を publish するが subscribe しないので deserialize 不可）。なので保存済みの serialized 文字列を**そのまま再送**し、routingKey に使う `eventName` だけを JSON の `data.type` から抜き出す。
- [`RabbitMQEventBus.drainFailover()`](../src/Contexts/Shared/infrastructure/EventBus/RabbitMq/RabbitMqEventBus.ts)：退避分を順に再送し、**成功した分だけ** failover から削除。1 件でも失敗（＝まだ未接続）したらそこで中断し残りは次回へ。at-least-once（messageId=eventId なので重複は下流の dedup で吸収）。
- [`EcBackendApp`](../src/apps/ec/backend/src/EcBackendApp.ts) / [`BackofficeApp`](../src/apps/backoffice/backend/src/BackofficeApp.ts)：`setupEventBus`（configure→addSubscribers→`drainFailover`）を **起動時と再接続成功直後の両方**で実行。起動時ドレインにより「前回プロセスが退避したまま落ちた分」も回収できる。
- 【テスト】[`RabbitMqEventBus.test.ts`](../src/Contexts/Shared/infrastructure/EventBus/RabbitMq/RabbitMqEventBus.test.ts)：生 content のまま再送・eventName→routingKey・成功分のみ削除・途中失敗で中断し残置・空なら no-op を UT（fake connection/failover 注入）。
- 【検証済】(1) 起動時ドレインで滞留 62 件→0（`failover_events_drained: 62件`）。(2) RabbitMQ 停止中に fault → Mongo に 1 件退避 → RabbitMQ 復帰 → 自動再接続(5回目)＋ドレインで 1 件→0。`pnpm test` 533 件 green

---

## 別トラック（本ロードマップ外・順序整合のため明記）

### #3 worker/edge 分離・RedisSSEAlertNotifier・read-model　✅ 実装済み

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

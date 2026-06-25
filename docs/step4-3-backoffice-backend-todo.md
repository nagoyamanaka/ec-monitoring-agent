# Step 4-3 TODO: backoffice/backend 実装

> 対応設計: `docs/step4-3-backoffice-backend.md`
> 前提: `step4-2`（Monitoringコンテキスト）のP0が完了していること。優先度: **P0** / **P1** / **stretch**。
> 参考実装: `src/apps/ec/backend/`（EcBackendApp.ts / config.ts / routes / controllers / middleware / subscribers）。
>
> **application 層の実装方針（共通・step4-2と同じ）**: handler / subscriber / controller は薄く保ち、ロジック本体は UseCase に移す。これらの責務は「入力（HTTPリクエスト/コマンド/ドメインイベント）→ コマンド/ドメイン型への変換」と「UseCase・Handler への委譲」だけ。分岐・永続化・publish・通知・ログ等は `XxxUseCase.run()` に置く（バス機構を介さず fake 注入で直接UTでき、源が変わっても本体を再利用できる）。テストは UseCase 側に書く。参考: `EC/Orders/.../PlaceOrderCommandHandler → PlaceOrderUseCase`。

---

## P0: 提出ライン

> **EC backend との対応関係について**
> タスク1〜8 は `src/apps/ec/backend/src/` の構成を基盤として設計されている。
> 対応表: タスク1=config.ts、タスク2=middleware/errorHandler.ts、タスク3=EcBackendApp.ts+start.ts+server.ts、
> タスク4=routes/index.ts（EC同様 App.ts は存在せず server.ts に統合）、タスク5=orders.route.ts+Controllers、
> タスク6=EC非存在のSSE固有追加、タスク7=demo.route.tsがベース+pattern/analytics追加、タスク8=EcSubscribers.ts。

### タスク 1: config.ts 〔P0〕　✅ 完了済み

<!-- EC対応: src/apps/ec/backend/src/config.ts と1対1。EC側に倣い const config = { ... } as const の単一オブジェクトでフラットに集約する。 -->

- 【新規】`src/apps/backoffice/backend/src/config.ts`
- 環境変数集約: MONGO_URL / RABBITMQ_HOST / RABBITMQ_PORT / RABBITMQ_USER / RABBITMQ_PASS / RABBITMQ_VHOST / RABBITMQ_RETRY_TTL / EXCHANGE_NAME / GEMINI_API_KEY / GEMINI_MODEL / FEEDBACK_AUTO_PROMOTE_THRESHOLD / DEMO_ENABLED（+P1: GITHUB_TOKEN / GITHUB_TARGET_REPO / INGEST_TOKEN）
- EC backend の config.ts に倣う

### タスク 2: errorHandler 〔P0〕✅ 完了済み

<!-- EC対応: src/apps/ec/backend/src/middleware/errorHandler.ts と同形。DomainError→400 / ApplicationError→400or404 / InfrastructureError→500 のマッピングを踏襲。backoffice固有の差分は AIInvestigationError を 500 に波及させないフォールバック処理のみ。 -->

- 【新規】`middleware/errorHandler.ts`（step3と同一マッピング。`AIInvestigationError` はHandler内fallbackで500に波及させない）
- 参考ファイル
  - src/apps/ec/backend/src/middleware/errorHandler.ts

### タスク 3: BackofficeApp.ts（DI配線）〔P0〕　✅ 完了済み

<!-- EC対応: EcBackendApp.ts と同形。EC側の start() の順序（MongoClient → RabbitMqConnection → EventBus → Repository/Port new → Handler/Bus登録 → Subscribers配線 → Server起動）をそのまま踏襲する。 -->

- 【新規/修正】`start.ts`（OTel + エントリ）/ `BackofficeApp.ts`（DI配線）/ `server.ts`（Express クラス）
- Mongo/RabbitMQ初期化 → Repository/Classifier/Port/Notifier を new（★差し替えポイント）→ Handler を Bus 登録 → BackofficeSubscribers で Subscriber 配線 → server.ts でルート登録 → listen
- 設計の「DI配線」手順に従う

### タスク 4: routes/index.ts 〔P0〕✅ 完了済み

<!-- EC対応: ECと同様、Server クラス（server.ts）が Express セットアップ（cors/json/errorHandler 登録）を担う。App.ts は存在しない。routes/index.ts の registerRoutes(router, ...deps) パターンは EC と同形。 -->

- 【新規】`routes/index.ts`（全ルート集約）

### タスク 5: alert 系ルート・コントローラ 〔P0〕✅ 完了済み

<!-- EC対応: orders.route.ts + controllers/orders/ と同形。registerAlertRoutes(router, commandBus, queryBus) のシグネチャもEC準拠。コントローラはルート関数内でnewしてバインドするECパターンを踏襲する。 -->

- 【新規】`routes/alertRoutes.ts` ＋ `AlertsGetController` / `AlertGetController` / `AlertFeedbackPatchController`（承認/却下＝reviewStatus更新）
- 委譲先は step4-2 の Query/CommandHandler

### タスク 6: SSE ストリーム 〔P0〕✅ 完了済み

<!-- EC非存在・backoffice固有追加。EC側に対応物なし。SSEAlertNotifier（Notifierポート実装）をDI注入するため、BackofficeApp.ts のDI配線にのみ影響する。ルート・コントローラ自体はEC流儀で薄く保つ。 -->

- 【新規】`routes/streamRoutes.ts` ＋ `AlertsStreamController`
- text/event-stream ヘッダ・heartbeat 30s・close時 removeConnection。`SSEAlertNotifier` 注入
- **Cloud Run時**: request timeout延長・min-instances>=1（設計の注意参照）

### タスク 7: patterns / analytics / demo ルート 〔P0〕✅ 完了済み

<!-- EC対応: demo部分は demo.route.ts + controllers/demo/PaymentModePostController.ts が対応物。pattern/analytics はbackoffice固有追加（EC非存在）。demoルートのDEMO_ENABLED guard も EC の DEMO_CONTROLS_ENABLED パターンを踏襲する。 -->

- 【新規】`patternRoutes.ts`（GET /patterns, POST /patterns/:id/promote）/ `analyticsRoutes.ts`（GET /analytics）/ `demoRoutes.ts`（POST /demo/\*\*・DEMO_ENABLEDで本番無効化）＋各Controller
- demo: payment-mode / scenario/:id/trigger / reset・reset/\* / status

### タスク 8: BackofficeSubscribers 〔P0〕　✅ 完了済み

<!-- EC対応: subscribers/EcSubscribers.ts と1対1。buildEcSubscribers(useCase1, useCase2) の関数形式・DomainEventSubscribers への集約パターンをそのまま踏襲する。 -->

- 【新規】`subscribers/BackofficeSubscribers.ts`（EcSubscribers.ts と同形の合成ルート）
- `CollectMonitoringEventOnECEventPublished`（step4-2・application層）を3キュー購読登録（order.placed / inventory.reservation_failed / payment.timeout）

> ✅ **ここまでで backoffice API ＋ SSE が動き、シナリオ1・2・3がUIまで通る。**

---

## P1: 差別化

### タスク 9: evidence ルート 〔P1〕　✅ 完了済み

- 【新規】`routes/evidenceRoutes.ts` ＋ `AlertEvidenceGetController`（evidence メソッド）
- GET /alerts/:id/evidence（InfraEvidence）
- 委譲先（application 層・AIInvestigation コンテキスト新規）
  - `GetInfraEvidenceQuery` → `GetInfraEvidenceUseCase`：alert を findById → `InfraInvestigationPort.collect()` で**証拠を再収集**（調査時の証拠は永続化していないため。全 Gateway は read-only）→ `InfraEvidenceResponse`（Date を ISO 正規化）
- `InfraEvidencePrimitives` を `AIInvestigation/domain/InfraEvidence.ts` に追加（ワイヤ契約）
- UT: GetInfraEvidence（not-found / 再収集・正規化）。BackofficeApp の queryBus にハンドラ登録
- 【改訂 2026-06・step4-1 §10】`GET /alerts/:id/investigation/status`（＋ `GetInvestigationStatus` UseCase 一式）は**削除**。証拠の done 判定は SSE で更新される alert.status から frontend が導出するため、status 専用エンドポイントは冗長（二重ソース）だった。証拠は「broadcast する小さな事実 / pull する重い詳細」の後者＝外部 API を叩く重い収集なので pull on-demand に残す（push しない）

### タスク 10: security-scan ingest 〔P1〕　✅ 完了済み

<!--
パターン選定: subscriber ではなく HTTP ingest コントローラ。
理由 = CI(GitHub Actions の Trivy/npm audit) は外部システムで、自システムの RabbitMQ に
DomainEvent を publish しない → 購読対象が無いので CollectMonitoringEventSubscriber は使えない。
同種の外部HTTP源である CloudMonitoringAlertIngestController（実装済み peer）と対称に、
CollectMonitoringEventUseCase.run() を直接呼ぶプレーンなコントローラとして実装する。
subscriber は EC 自前 DomainEvent（CollectMonitoringEventOnECEventPublished）専用。
-->

- 【新規】`controllers/ingest/SecurityScanIngestPostController.ts` ＋ `routes/ingestRoutes.ts` に `POST /ingest/security-scan` 追加
- X-Ingest-Token検証 → HIGH/CRITICAL未満は204 → MonitoringEvent(category=SECURITY, source=npm_audit)構築 → `CollectMonitoringEventUseCase.run()`（内部で AnalyzeAlertCommand dispatch）→ 202
- DI は既存の `IngestDependencies`（collectMonitoringEventUseCase / ingestToken）を再利用＝BackofficeApp 配線は変更不要
- CI（step4-1 タスク4）と結線。シナリオ5の起点

### タスク 11: remediation ルート 〔P1〕　✅ 完了済み

- 【新規】`routes/remediationRoutes.ts` ＋ `RemediationDraftPrPostController`（POST→`DraftRemediationCommand`・202）/ `RemediationGetController`（GET→`GetRemediationQuery`）
- POST `/alerts/:id/remediation/draft-pr`（承認＝手動POST→`RemediationPort.draftPullRequest`・draft起票）/ GET `/alerts/:id/remediation`（PR URL・状態）
- application: `DraftRemediation`（UseCase/Command/Handler）＝ alert.payload.vulnerabilities[] を入力に AI で全CVEの修正方針を起草→草案PR起票→結果を `RemediationRepository` に保存 / `GetRemediation`（UseCase/Query/Handler/Response）＝状態読み取り（未起票は status="none"）
- domain（`AIInvestigation/domain/remediation`）: `RemediationPlanner` ポート（追加）/ `RemediationRecord`+`RemediationRepository`（追加）。既存 `RemediationPort`/`RemediationPlan`/`GitHubPullRequestGateway` を再利用
- infra: `LLMRemediationPlanner`（既存 `LLMTextClient` 再利用・LLM失敗/stub時は fixedVersion ベースの決定論フォールバック→`SECURITY_REMEDIATION.md` 草案）/ `MongoRemediationRepository`（collection=remediations・_id=alertId）
- DI: `BackofficeApp` で planner（llmClient 共用）/ gateway（`config.github.remediationRepo` 明示）/ repo を new、Draft を commandBus・Get を queryBus に登録
- config/env: `GITHUB_REMEDIATION_REPO`（未設定は `GITHUB_TARGET_REPO` フォールバック）を追加

**実行戦略は2モード（`RemediationExecutor` で差し替え・`config.remediation.mode`）**:
- **advisory**（既定・CI不要）: in-process で `LLMRemediationPlanner` が方針テキストのみ生成→ `SECURITY_REMEDIATION.md` の草案PR（実コードは直さない・人間が直す前提）。LLM はファイルパス/パッチ全文を生成しない（ハルシネーション防止の足場）。GitHub/CI 不在のローカル・デモ用フォールバック
- **dispatch**（agentic・本命）: `GitHubActionsRemediationDispatcher` が `repository_dispatch(ai-remediation, {alertId, vulnerabilities})` を投げる→ ターゲットリポの `.github/workflows/ai-remediation.yml` が **ブランチ作成→AIエージェント(Gemini CLI/差し替え可)が実コード修正→trivy 再スキャン+UT/E2E が緑→draft PR**。**修正精度はランナーのテストゲートで担保**（APIサーバ内では実コードを書かない）
- **結果 callback**: dispatch は非同期＝起票時は `dispatched`（PR URL 無し）。CI 完了時に `POST /ingest/remediation-result`（x-ingest-token）で `drafted`(PR URL)/`failed`(理由) に確定（`RecordRemediationResultUseCase`）。GET /remediation がそれを返す
- **結果の SSE push（改訂 2026-06・step4-1 §10）**: 確定はクライアント操作が起点に無い非同期更新なので、`RecordRemediationResultUseCase`・`DraftRemediationUseCase` が `SSEAlertNotifier.notifyRemediation()` で**名前付きイベント `remediation` を push** する（`RemediationResponsePrimitives` 契約・GET と同形）。frontend は dispatched 表示のままポーリングせず push で確定を反映。`EventEmitterSSEAlertNotifier` は既定 alert イベントと `event: remediation` を1接続に多重化
- 過去のローカル版（Trivyローカルスキャン+Copilot Agent プロンプト）の CI/CD 化に相当。Gemini は Vertex AI 認証で GCP 無料クレジット内、品質不足なら workflow の1ステップを `claude-code-action` に差し替え
- **自己修正ループ上限（課金安全弁）**: CI は「AI修正→検証（trivy再スキャン+typecheck+test）→赤ならログをフィードバックして再修正」を `REMEDIATION_MAX_ATTEMPTS`（既定2）回まで回し**必ず打ち切る**（無限リトライ＝課金暴走を防ぐ）。上限は `config.remediation.maxAttempts` が単一ソースで、dispatch の `client_payload.maxAttempts` として CI に渡す。上限超過は `failed`（PR起票なし）で callback

- リメディ入力は security-scan の `payload.vulnerabilities[]`（全 HIGH/CRITICAL）。AI で一括修正 PR を起票

<!--
【認識合わせ: Trivy 生出力 ⇔ security-scan ボディ／代表CVE+全件 設計】（step4-1 タスク4と結線）

問題: `trivy fs --format json` は `Results[].Vulnerabilities[]` のネストで HIGH/CRITICAL を
「どばっと」吐く。一方 `SecurityScanIngestPostController` のボディは CVE 1件のフラット構造で、
そのまま投げても受からない（フィールド名も VulnerabilityID/PkgName と cveId/package で異なる）。

採用方針 = 「A: CI 側 jq 変換 ＋ 案2: 最深刻を代表CVEに寄せる」＋「全件 payload 同梱」:
  CI(.github/workflows/ci.yml security-scan job)
    1. trivy fs --severity HIGH,CRITICAL --format json（--exit-code 0＝ビルドは落とさない）
    2. jq で HIGH/CRITICAL 抽出 → CRITICAL 優先で最深刻=代表CVEをトップレベル昇格
       → 全件を vulnerabilities[] に同梱 → 1回だけ POST /ingest/security-scan
  Controller
    - 代表CVEで MonitoringEvent(category=SECURITY, severity=CRITICAL|WARNING, source=scanner) を構築
    - payload に { 代表CVE項目..., scanner, target, repo, vulnerabilityCount, vulnerabilities[] }
    - HIGH/CRITICAL 未満は 204。source=scanner なので dedupKey は scanner×SECURITY×eventName 粒度
      → CI 再実行・複数CVE は1インシデント(×occurrenceCount)に畳まれる（storm 抑制と整合）

なぜ代表CVE+全件か: インシデントは最悪CVEにアンカーして物語を1本に絞りつつ、リメディは
全件を直す必要がある。dispatch/advisory いずれも payload.vulnerabilities を入力に
「全CVE をまとめて修正する1 PR」を起票する（個別CVE詳細を失わないため全件同梱）。
INGEST_URL/INGEST_TOKEN は GitHub Secrets。INGEST_URL 未設定時は scan-only でスキップ（Cloud Run 未デプロイでも CI は緑）。
-->

### タスク 16: 検証付きリメディ・ターゲットルーティング（提案・未実装）〔P1〕

> **状態: 設計のみ。実装は未着手。** トークン×CI分が multiplicative に増えるため、効果を見極めてから着手。
> タスク11（dispatch経路）の `RemediationExecutor`/`ai-remediation.yml`/callback/`maxAttempts` 基盤を流用する。

<!--
【前提の誤りを正す（このタスクの出発点）】
当初構想は「AI調査→コード修正案→GitHub Actionsへ投げてUT検証」だったが、これは成立しない。
障害の根本原因は「アプリのコードデグレ」だけではないため、"コード修正→Actionに投げるだけ" では
直せない／検証できないインシデントが大半を占める。フィードバック先（修正ターゲット）と
"緑"（検証ゲート）の定義は根本原因カテゴリごとに異なる。よって設計の中心は
「検証ループ」ではなく【修正ターゲットのルーティング】に置く。

【修正ターゲットと検証ゲート（カテゴリ別）】MonitoringEventCategory を起点に分岐:
- APPLICATION / SECURITY(自リポのコード由来):
    ターゲット = アプリのコード/依存。修正 = PR（タスク11の ai-remediation を流用）。
    検証ゲート = trivy再スキャン + typecheck + UT/E2E（＝既存の "緑"）。← 唯一きれいに自動修正+自動検証できる。
- INFRASTRUCTURE / CAPACITY(自前 IaC 由来。Terraform デグレ・設定ミス・スケール不足):
    ターゲット = IaC リポ（Terraform/manifest）。修正 = IaC への PR。
    検証ゲート = `terraform plan`/`validate`（UTではない！）。apply は人間承認後（本番writeは絶対に自動化しない）。
    → ai-remediation とは別ジョブ（例 ai-iac-remediation）と別の "緑" 判定が要る。
- 外部起因（ベンダー障害・マネージドサービス停止・上流API障害・データ起因 等):
    自分たちのコードでも IaC でも直せない。ターゲット = runbook/手順 + 通知/エスカレーション。
    自動修正も検証ループも回さない（回しても緑にならず課金だけ増える）。"修正対象外" として明示ルーティングする。

【設計の継ぎ目】
- `RemediationTargetRouter`（新）: 検証済み根本原因（InvestigationReport + category）→ ターゲット種別を決める。
- ターゲット種別ごとに `VerifiableRemediation`（execute + 固有の verifyゲート）を実装。
  RemediationExecutor を「app-code / iac / none(runbook)」へ一般化した姿。
- 検証ループ（生成→検証→フィードバック→再生成）は automatable なターゲット（app-code / iac）でのみ回す。
  上限は `config.remediation.maxAttempts` を共有（タスク11と同じ安全弁）。上限超過は人間へエスカレーション。
- ループ制御は application 層の新 UseCase（例 `RouteAndVerifyRemediation`）に置き、Handler/Controller は薄く保つ。
- read-only 不変条件は不変: 検証は「仮ブランチ/`terraform plan`」での実行であって本番writeではない。
  最終適用（PR merge / terraform apply）は人間承認後に限定。

【コスト注意（着手前提）】
- multiplicative なループは maxAttempts で必ず打ち切る（タスク11で実装済みの仕組みを共有）。
- runbook ターゲットはループ自体を回さない＝最大の節約。先にルーティングで "対象外" を弾くのが効く。
- 段階導入: ①app-code ターゲットの1イテレーション固定（既存 ai-remediation そのまま）→ ②検証ゲート＋自己修正ループ
  （maxAttempts）→ ③RemediationTargetRouter で iac/runbook 分岐を追加。env フラグ既定off・既存P0/P1は無傷。
-->
- 【新規(将来)】`RemediationTargetRouter`（root cause → app-code / iac / runbook 振り分け）＋ ターゲット別 `VerifiableRemediation`
- 【新規(将来)】`application/RouteAndVerifyRemediation`（ルーティング→automatableなら検証ループ・`maxAttempts` 共有→結果取り込み）
- 【再利用】`RemediationExecutor`/`ai-remediation.yml`/callback/`maxAttempts`。iac 用は別ジョブ＋`terraform plan` ゲートを追加
- 段階導入: ①app-code 1イテレーション固定 → ②検証ゲート＋自己修正ループ → ③iac/runbook 分岐。env 既定off・既存無傷

---

## stretch

### タスク 12: Cloud Run デプロイ 〔stretch〕

- backoffice（or 調査API）をコンテナ化して Cloud Run へ（「とどける」見せ場）
- EDA常駐Subscriber部分はCEに残す折衷（戦略ADR）

---

## stretchⅠ: Cloud Run + Valkey ハイブリッド運用（SSE Pub/Sub ＋ read-model）

> **着手条件**: タスク12（Cloud Run デプロイ）と並走。設計は `step4-1` §11.1/§11.3、IaC は `infra/terraform/`。
> **原則**: Valkey は SoT でなく「**再構築可能な read-model projection ＋ Pub/Sub transport**」。Mongo SoT ＋ cache-aside fallback で **Valkey 障害を「障害」でなく「性能劣化」に縮める**。既存の `EventEmitterSSEAlertNotifier`（in-process）/ Mongo 直読は無傷のまま、interface 差し替え／前段追加で載せる（§10「スケールアウト時」と一致）。
> （タスク番号は採番順。配置は優先度順で stretchⅠ < Ⅱ < Ⅲ）

### タスク 16: Valkey クライアント ＋ config 〔stretchⅠ〕

- 【新規】Valkey 接続（ioredis 等）。`REDIS_URL` 未設定時は **null object**（publish/subscribe no-op・read-model 無効）でフォールバックし、ローカル/テストは現状の in-process 動作のまま
- 【修正】`config.ts`：`REDIS_URL`（既定空＝無効）/ `ROLE`（`all`|`worker`|`edge`・既定 `all`）追加（`REDIS_URL` は compose/Cloud Run に注入済み・アプリ未読込なら no-op）
- 依存追加は pnpm `--filter` で backoffice backend のみに閉じる

### タスク 17: RedisSSEAlertNotifier（SSE Pub/Sub fan-out・案1）〔stretchⅠ〕

- 【新規】`AlertNotification/infrastructure/RedisSSEAlertNotifier.ts` implements `SSEAlertNotifier`（既存 IF をそのまま差し替え）
  - worker 側 `notify()` / `notifyRemediation()` は Valkey channel に publish（名前付きイベント `alert` / `remediation` を payload に保持）
  - edge 側は購読して **接続中の各 SSE クライアントへ fan-out**（既存 `AlertsStreamController` の EventEmitter を Valkey subscriber に接続）
- **`SSEAlertNotifier` IF・`AnalyzeAlertUseCase`/`InvestigateAlertUseCase`/`AlertsStreamController` はノータッチ**（composition root の差し替えのみ）。多インスタンス SSE が壊れない＝案1 の必然性が成立
- Valkey down 時：publish は握りつぶし、edge は frontend 再接続時の再フェッチでギャップを埋める（best-effort liveness・§11.3）

### タスク 18: Alert read-model projection（CQRS read model in Redis・案②）〔stretchⅠ〕

- 【新規】Alert ライフサイクル DomainEvent（生成 / 分析中 / 調査完了 / dedup 更新 / feedback）を購読する **projector** が、`GET /alerts` 一覧スナップショットと `/alerts/:id` 詳細を Valkey に **upsert（alert id キー・冪等）**
  - **書き込み順序**: SoT（Mongo）保存後に projection を派生。cache を真実の前段にしない（§11.3）
  - at-least-once ＋ 冪等 upsert で projector クラッシュ後も再投影で自己回復（結果整合）。projection は再構築可能（§7.9 ForecastMemory と同原則）
- 【修正】読み取り経路を **cache-aside**：`GetAlertUseCase` / 一覧 Controller が **Valkey hit→返す／miss・down→Mongo にフォールバックして再投入**。`AlertRepository`（Mongo）が常に真実
  - 設計判断: read-model は `AlertReadModelStore` IF の裏に隔離。`REDIS_URL` 無効時は素通しで Mongo 直読（現状動作を壊さない）
- 証拠（`/alerts/:id/evidence`）は §10 のとおり pull on-demand 維持。重い外部収集の TTL キャッシュは任意（時間が余れば）

### タスク 19: worker / edge ロール分離 〔stretchⅠ〕

- 【修正】`BackofficeApp.ts`：`ROLE` で起動を分岐
  - `worker`：RabbitMQ Subscriber（EC ingest / AnalyzeAlert / InvestigateAlert）＋ projector（タスク18）＋ `RedisSSEAlertNotifier`(publish 側)。クエリ HTTP は health のみ
  - `edge`：クエリ / SSE ルートのみ。RabbitMQ Subscriber を起動しない。`RedisSSEAlertNotifier`(subscribe 側) ＋ read-model 読み取り
  - `all`（既定・ローカル/現状）：両方を1プロセス（in-process notifier・Mongo 直読でも可）
- **Cloud Run edge=`ROLE=edge` / GCE worker=`ROLE=worker`**（§11.1）。既存の単一プロセス（`all`）起動を壊さない段階移行

### タスク 20: 検知 webhook トークン互換（B 残作業）〔stretchⅠ〕→ **step4-5 T1 へ移動**

> デプロイ垂直疎通の前提条件のため `docs/step4-5-backoffice-infra.todo.md` タスク T1 に移動・集約した。内容はそちらを正とする。

---

## stretchⅡ: 予兆ブリーフィング 配線

> **着手条件**: P0 ＋ P1 ＋ 既存stretch 着地後。設計は `step4-3`「予兆ブリーフィング配線」節。既存配線は無傷で、ルート1系統＋DIを追加するだけ。

### タスク 13: forecast ルート・コントローラ 〔stretchⅡ〕

- 【新規】`routes/forecastRoutes.ts` ＋ `ForecastPostController`（POST /forecast → `ForecastRiskCommandHandler`）/ `ForecastGetController`（GET /forecast → 最新 RiskForecast）
- `routes/index.ts` に登録（既存ルートはノータッチ）

### タスク 14: DI 追記 ＋ Schedule seed 〔stretchⅡ〕

- 【修正】`BackofficeApp.ts`：read-only依存を new して `ForecastRiskCommandHandler` を Bus 登録
  - **★継ぎ目**: `signalSources: ForecastSignalSource[]` を組み立てて渡す（Gateway を名指ししない）。`PullRequestSignalSource`（GitHub）/ `PendingPlanSignalSource`（Terraform〔メソッド追加済〕）/ `ScheduleSignalSource`（ScheduleSource）の3つ
  - `ForecastMemoryRepository` / **ForecastPort=GeminiForecastAdapter★差し替え点**
- 起動時 `ForecastMemoryRepository.warmUp()` を `BackofficeApp.buildSimilarIncidentRepository(rules)` 呼び出しと並行して `start()` 内に追加する（SimilarIncident の warmUp は `buildSimilarIncidentRepository` 内に内包済み）
- 【新規】`ScheduleSource` の seed 実装（JSON/config）。`DEMO_ENABLED` 配下で投入
- 【修正】`config.ts`：`FORECAST_ENABLED`（既定off）/ `FORECAST_HORIZON`（既定 "今週末"）追加
- **write は発生しない**（全Gateway read-only）。リメディエーション要時のみ既存 `RemediationPort` 再利用

---

## stretchⅢ: イベントソーシング基盤 配線（設計のみ・実装はハッカソン後）

> **着手条件**: stretchⅡ 着地後。設計は `step4-3`「ログベース・イベントソーシング基盤 配線」節 ＋ `step4-1` §7.10。既存配線は無傷。

### タスク 15: EventLog sink ＋ 予知ビュー合流 配線 〔stretchⅢ〕

- 【修正】`BackofficeSubscribers.ts`：`AppendEventLogOnDomainEvent`（全 DomainEvent 購読 → `EventLogRepository.append()`）を追加（正常系も貯める）
- 【修正】`BackofficeApp.ts`：`EventLogRepository`（Mongo append-only）を new。`EventLogPrecursorSource` を組み立て、タスク14 の `signalSources` 配列に push（**Handler/Controller/ルートはノータッチ**）
- 【修正】`ForecastMemoryRepository.warmUp()` の投影元を Mongo(Resolved) → `EventLogRepository` に差し替え
- 新規ルート不要（予知ビューは既存 `POST /forecast` に合流）。**write は発生しない**

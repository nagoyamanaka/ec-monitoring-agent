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

- 【新規】`routes/evidenceRoutes.ts` ＋ `AlertEvidenceGetController`（evidence/status の2メソッド）
- GET /alerts/:id/evidence（InfraEvidence）/ GET /alerts/:id/investigation/status（collecting/analyzing/done）
- 委譲先（application 層・AIInvestigation コンテキスト新規）
  - `GetInfraEvidenceQuery` → `GetInfraEvidenceUseCase`：alert を findById → `InfraInvestigationPort.collect()` で**証拠を再収集**（調査時の証拠は永続化していないため。全 Gateway は read-only）→ `InfraEvidenceResponse`（Date を ISO 正規化）
  - `GetInvestigationStatusQuery` → `GetInvestigationStatusUseCase`：alert から status を導出（report 添付 or 既知パターン→done / 未知・未添付→analyzing。`collecting` は永続フェーズ未追跡のため契約上予約）
- `InfraEvidencePrimitives` を `AIInvestigation/domain/InfraEvidence.ts` に追加（ワイヤ契約）
- UT: 両 UseCase（not-found / 再収集・正規化 / status 導出4分岐）。BackofficeApp の queryBus に2ハンドラ登録

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

### タスク 11: remediation ルート 〔P1〕

- 【新規】`routes/remediationRoutes.ts` ＋ `RemediationDraftPrPostController` / `RemediationGetController`
- POST draft-pr（承認後に `RemediationPort.draftPullRequest`）/ GET remediation（PR URL・ステータス）

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
全件を直す必要がある。タスク11の `RemediationPort.draftPullRequest` は payload.vulnerabilities を
入力に、AI 経由で「全CVE をまとめて修正する1 PR」を起票する（個別CVE詳細を失わないため全件同梱）。
INGEST_URL/INGEST_TOKEN は GitHub Secrets。INGEST_URL 未設定時は scan-only でスキップ（Cloud Run 未デプロイでも CI は緑）。
-->
- リメディ入力は security-scan の `payload.vulnerabilities[]`（全 HIGH/CRITICAL）。AI で一括修正 PR を起票

---

## stretch

### タスク 12: Cloud Run デプロイ 〔stretch〕

- backoffice（or 調査API）をコンテナ化して Cloud Run へ（「とどける」見せ場）
- EDA常駐Subscriber部分はCEに残す折衷（戦略ADR）

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

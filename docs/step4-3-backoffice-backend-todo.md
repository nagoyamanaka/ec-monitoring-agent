# Step 4-3 TODO: backoffice/backend 実装

> 対応設計: `docs/step4-3-backoffice-backend.md`
> 前提: `step4-2`（Monitoringコンテキスト）のP0が完了していること。優先度: **P0** / **P1** / **stretch**。
> 参考実装: `src/apps/ec/backend/`（EcBackendApp.ts / config.ts / routes / controllers / middleware / subscribers）。

---

## P0: 提出ライン

### タスク 1: config.ts 〔P0〕

- 【新規】`src/apps/backoffice/backend/src/config.ts`
- 環境変数集約: MONGO_URL / RABBITMQ_URL / GEMINI_API_KEY / GEMINI_MODEL / FEEDBACK_AUTO_PROMOTE_THRESHOLD / DEMO_ENABLED（+P1: GITHUB_TOKEN / GITHUB_TARGET_REPO / INGEST_TOKEN）
- EC backend の config.ts に倣う

### タスク 2: errorHandler 〔P0〕

- 【新規】`middleware/errorHandler.ts`（step3と同一マッピング。`AIInvestigationError` はHandler内fallbackで500に波及させない）

### タスク 3: BackofficeApp.ts（DI配線）〔P0〕

- 【新規/修正】`BackofficeApp.ts` / `server.ts`（現状TODOコメントのみ）
- Mongo/RabbitMQ初期化 → Repository/Classifier/Port/Notifier を new（★差し替えポイント）→ Handler を Bus 登録 → BackofficeSubscribers で Subscriber 配線 → App.ts でルート登録 → listen
- 設計の「DI配線」手順に従う

### タスク 4: App.ts ＋ routes/index.ts 〔P0〕

- 【新規】`App.ts`（Express セットアップ）/ `routes/index.ts`（全ルート集約）

### タスク 5: alert 系ルート・コントローラ 〔P0〕

- 【新規】`routes/alertRoutes.ts` ＋ `AlertsGetController` / `AlertGetController` / `AlertFeedbackPatchController`（承認/却下＝reviewStatus更新）
- 委譲先は step4-2 の Query/CommandHandler

### タスク 6: SSE ストリーム 〔P0〕

- 【新規】`routes/streamRoutes.ts` ＋ `AlertsStreamController`
- text/event-stream ヘッダ・heartbeat 30s・close時 removeConnection。`SSEAlertNotifier` 注入
- **Cloud Run時**: request timeout延長・min-instances>=1（設計の注意参照）

### タスク 7: patterns / analytics / demo ルート 〔P0〕

- 【新規】`patternRoutes.ts`（GET /patterns, POST /patterns/:id/promote）/ `analyticsRoutes.ts`（GET /analytics）/ `demoRoutes.ts`（POST /demo/\*\*・DEMO_ENABLEDで本番無効化）＋各Controller
- demo: payment-mode / scenario/:id/trigger / reset・reset/\* / status

### タスク 8: BackofficeSubscribers 〔P0〕

- 【新規】`subscribers/BackofficeSubscribers.ts`（EcSubscribers.ts と同形の合成ルート）
- `CollectMonitoringEventOnECEventPublished`（step4-2・application層）を3キュー購読登録（order.placed / inventory.reservation_failed / payment.timeout）

> ✅ **ここまでで backoffice API ＋ SSE が動き、シナリオ1・2・3がUIまで通る。**

---

## P1: 差別化

### タスク 9: evidence ルート 〔P1〕

- 【新規】`routes/evidenceRoutes.ts` ＋ `AlertEvidenceGetController`
- GET /alerts/:id/evidence（InfraEvidence）/ GET /alerts/:id/investigation/status（collecting/analyzing/done）

### タスク 10: security-scan ingest 〔P1〕

- 【新規】`routes/ingestRoutes.ts` ＋ `SecurityScanIngestPostController`
- X-Ingest-Token検証 → HIGH未満は204 → MonitoringEvent(SECURITY)構築 → AnalyzeAlartCommand dispatch → 202
- CI（step4-1 タスク4）と結線。シナリオ5の起点

### タスク 11: remediation ルート 〔P1〕

- 【新規】`routes/remediationRoutes.ts` ＋ `RemediationDraftPrPostController` / `RemediationGetController`
- POST draft-pr（承認後に `RemediationPort.draftPullRequest`）/ GET remediation（PR URL・ステータス）

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
- 【修正】`BackofficeApp.ts`：read-only依存を new して `ForecastRiskCommandHandler` を Bus 登録（GitHub/Terraform Gateway〔メソッド追加済〕/ ScheduleSource / ForecastMemoryRepository / **ForecastPort=GeminiForecastAdapter★差し替え点**）
- 起動時 `ForecastMemoryRepository.warmUp()` を `SimilarIncidentRepository.warmUp()` と並べる
- 【新規】`ScheduleSource` の seed 実装（JSON/config）。`DEMO_ENABLED` 配下で投入
- 【修正】`config.ts`：`FORECAST_ENABLED`（既定off）/ `FORECAST_HORIZON`（既定 "今週末"）追加
- **write は発生しない**（全Gateway read-only）。リメディエーション要時のみ既存 `RemediationPort` 再利用

# Step 4-3: backoffice/backend 設計（Express アプリ配線）

> **Step4 を4分割したうちの「backoffice/backend」担当。**
> Monitoring コンテキスト（`step4-2`）のドメイン/アプリ/インフラを **Express アプリとして配線**する責務に限定する。
> ドメイン設計そのものは `step4-2`、UIは `step4-4` を参照。
>
> 前提: `step4-2-monitoring-context.md` 完了。`src/apps/backoffice/backend/src/server.ts` は現在 TODO コメントのみ。

---

## 責務の範囲

| 含む | 含まない |
| ---- | -------- |
| Express App セットアップ・ルーティング | Alert/AIInvestigation等のドメインロジック（step4-2） |
| Controller（HTTPの入出力変換） | UseCase/CommandHandlerの中身（step4-2） |
| 手動DI配線（Poor Man's DI） | React UI（step4-4） |
| RabbitMQ Subscriber 登録 | EC backend（既存・step3） |
| SSEエンドポイントのHTTP機構 | `SSEAlertNotifier` interface自体（step4-2のAlertNotification） |
| errorHandler / config / 環境変数 | |

---

## ディレクトリ（step1準拠）

```
src/apps/backoffice/backend/src/
├── server.ts                    # エントリポイント（BackofficeApp.start()）
├── BackofficeApp.ts             # DIセットアップ・インフラ初期化・アプリ起動
├── App.ts                       # Express appセットアップ（registerRoutes）
├── config.ts                    # 環境変数集約（EC backendのconfig.tsに倣う）
├── routes/
│   ├── index.ts                 # 全ルート集約
│   ├── alertRoutes.ts           # GET /alerts, GET /alerts/:id, PATCH /alerts/:id/feedback
│   ├── evidenceRoutes.ts        # GET /alerts/:id/evidence, GET /alerts/:id/investigation/status
│   ├── remediationRoutes.ts     # POST /alerts/:id/remediation/draft-pr, GET /alerts/:id/remediation
│   ├── ingestRoutes.ts          # POST /ingest/security-scan
│   ├── patternRoutes.ts         # GET /patterns, POST /patterns/:id/promote
│   ├── analyticsRoutes.ts       # GET /analytics
│   ├── streamRoutes.ts          # GET /alerts/stream（SSE）
│   └── demoRoutes.ts            # POST /demo/**（環境変数で本番無効化）
├── controllers/                 # step1のコントローラ一覧に準拠
├── middleware/
│   └── errorHandler.ts          # step3と同一マッピング（Monitoringのエラーも同基底3クラス）
└── subscribers/
    └── BackofficeSubscribers.ts # 合成ルート：CollectMonitoringEventOnECEventPublished（application層）を EventBus に配線（EcSubscribers.ts と同形）
```

---

## DI 配線（BackofficeApp.ts）

`EcBackendApp.ts` と同じ Poor Man's DI。`start()` で依存を手動 new。**インターフェース注入で実装差し替え可能な構造を維持**（フェーズ移行はここ1箇所の差し替え）。

```
BackofficeApp.start():
  1. config 読み込み（config.ts）
  2. MongoClientFactory / RabbitMqConnection 初期化
  3. Repository実装を new
     - MongoAlertRepository / MongoKnownErrorPatternRepository
     - InMemorySimilarIncidentRepository（起動時 warmUp(mongo既存)）
  4. Classifier / Port を new（★差し替えポイント・分類器の composition root）
     - AlertClassifier:        PolicyBasedAlertClassifier([
                                 ApplicationClassificationPolicy(
                                   [ KnownPatternRule(MongoKnownErrorPatternRepository) ],  // 将来: + SimilarPatternRule(Elastic)
                                   ClassificationRuleSorter,   // kind優先順位で並べ替え（配列順に依存しない）
                                 ),
                               ])
     - AIInvestigationPort:     GeminiAIInvestigationAdapter（→将来 Vertex/ADK）
     - InfraInvestigationPort:  DefaultInfraInvestigationAdapter（各Gateway注入）
     - RemediationPort:         GitHubPullRequestGateway（GITHUB_TOKEN/対象repo限定）
     - SSEAlertNotifier:        EventEmitterSSEAlertNotifier
  5. CommandHandler / QueryHandler を組み立て InMemoryCommandBus/QueryBus に登録
     - AnalyzeAlertCommandHandler
     - SubmitFeedbackCommandHandler / PromotePatternCommandHandler
     - GetAlertReportQueryHandler 等
  6. BackofficeSubscribers で DomainEventSubscriber を EventBus に配線（addSubscribers / RabbitMQ購読開始）
     - CollectMonitoringEventOnECEventPublished（EC源 → AnalyzeAlert）
     - InvestigateAlertOnAlertClassifiedUnknown（InvestigateAlertDomainEvent → AI調査）★内部イベント購読
  7. App.ts で Express ルート登録 → listen
```

> **差し替えの一覧**: フェーズ移行（InMemory→Elastic / Gemini→ADK）は手順4の new を変えるだけ。Controller・Handler はノータッチ。

---

## Controller 設計方針

Controller は **HTTPの入出力変換のみ**（薄いルーター）。VO変換・ビジネスロジックは Handler/UseCase（step4-2）に委譲。

| Controller | メソッド | 委譲先 |
| ---------- | -------- | ------ |
| `AlertsGetController` | GET /alerts | `GetAlertReportQuery`（全件 `Criteria([])`、将来 createdAt DESC/ページング） |
| `AlertGetController` | GET /alerts/:id | findById |
| `AlertFeedbackPatchController` | PATCH /alerts/:id/feedback | `SubmitFeedbackCommand`（承認/却下＝reviewStatus更新も同時） |
| `AlertEvidenceGetController` | GET /alerts/:id/evidence, /investigation/status | InfraEvidence / 調査ステータス取得 |
| `RemediationDraftPrPostController` | POST /alerts/:id/remediation/draft-pr | `RemediationPort.draftPullRequest()`（承認後のwrite） |
| `RemediationGetController` | GET /alerts/:id/remediation | 起票済みPRのURL/ステータス |
| `SecurityScanIngestPostController` | POST /ingest/security-scan | 後述 |
| `AlertsStreamController` | GET /alerts/stream | SSE接続管理（後述） |
| `PatternsGetController` / `PatternPromotePostController` | GET /patterns, POST /patterns/:id/promote | パターン取得・手動昇格 |
| `AnalyticsGetController` | GET /analytics | AI精度トラッキング |
| demo/* | POST /demo/** | デモ制御（環境変数で本番無効化） |

---

## SecurityScanIngestPostController（CI → MonitoringEvent）

`POST /ingest/security-scan`。CI（GitHub Actions の Trivy/npm audit）からのスキャン結果を受け、**ECDomainEvent を経由せず直接 `MonitoringEvent(category=SECURITY)` を構築**して調査パイプラインへ流す。

```
1. リクエストボディ（cveId, severity, package, version, fixedVersion, repo 等）を受ける
   - 認証: 共有シークレットヘッダ（X-Ingest-Token）で検証（最低限）
2. severity が HIGH/CRITICAL 未満は 204 で無視（しきい値ガード）
3. MonitoringEvent を構築:
   { eventId: uuid(), eventName: 'security.vulnerability_detected',
     aggregateId: cveId, occurredOn: now,
     category: 'SECURITY', source: 'npm_audit',
     payload: { cveId, severity, package, version, fixedVersion } }
4. AnalyzeAlertCommand を構築して dispatch（既存の調査パイプラインに合流）
5. 202 Accepted を返す（調査は非同期、結果はSSEで配信）
```

> **設計実証**: `MonitoringEvent` が EC と疎結合である（ECDomainEvent以外の入力源も同じ型に正規化できる）ことをこの経路が示す。

---

## SSE エンドポイント（AlertsStreamController）

`SSEAlertNotifier`（interface・実装は step4-2 の `EventEmitterSSEAlertNotifier`）の HTTP 機構部分。

```
GET /alerts/stream
1. res.setHeader('Content-Type', 'text/event-stream')
2. res.setHeader('Cache-Control', 'no-cache')
3. res.setHeader('Connection', 'keep-alive')
4. SSEAlertNotifier.addConnection(res)
5. 30秒ごとにハートビート（': heartbeat\n\n'）で接続維持
6. req.on('close') → SSEAlertNotifier.removeConnection(res)
```

- e2-medium / Cloud Run 単インスタンス前提のオンメモリ。複数インスタンス化時は `RedisSSEAlertNotifier` に差し替え（interface維持）。
- **Cloud Run 注意**: SSE常時接続は request timeout・min-instances設定が要る。backofficeをCloud Runに載せる場合はタイムアウトを延長し min-instances>=1。EDA常駐Subscriber（RabbitMQ）はCloud Runと相性が悪いため、Subscriber駆動部分はCE側に置く折衷も検討（戦略ADR参照）。

---

## Subscriber 登録（BackofficeSubscribers.ts）

backoffice プロセスが起動時に登録。EC backend とは別プロセス。

```
購読キュー（障害系イベントに絞る）:
  backoffice-backend.ec.order.placed.collect-monitoring-event
  backoffice-backend.ec.inventory.reservation_failed.collect-monitoring-event
  backoffice-backend.ec.payment.timeout.collect-monitoring-event

→ CollectMonitoringEventOnECEventPublished（step4-2）が ECDomainEvent → MonitoringEvent 変換 → AnalyzeAlertCommand dispatch
```

`ec.inventory.reserved`（正常系）は購読しない。

---

## errorHandler / config

- `errorHandler`: step3 と同一マッピング（DomainError→400 / ApplicationError→400・ResourceNotFound→404 / InfrastructureError→500）。`AIInvestigationError` は Handler 内 catch で fallback 化されるため 500 に波及しない（step4-2）。
- `config.ts`: 環境変数を集約（MONGO_URL / RABBITMQ_URL / GEMINI_API_KEY / GEMINI_MODEL / GITHUB_TOKEN / GITHUB_TARGET_REPO / INGEST_TOKEN / FEEDBACK_AUTO_PROMOTE_THRESHOLD / DEMO_ENABLED）。`EcBackendApp` の config.ts 集約に倣う。

---

## 予兆ブリーフィング 配線（stretchⅡ）

> **位置づけ**: P0 ＋ P1 ＋ 既存stretch 着地後の capstone。設計全体は `step4-1` 7章、ドメイン/アプリ/インフラは `step4-2`「予兆ブリーフィング」節。本節は **Express 配線（routes/controllers/DI/seed）** に限定。既存配線は無傷で、ルート1系統と DI を追加するだけ。

### ルート・コントローラ（追加）

| メソッド | パス | コントローラ | 委譲先 |
| -------- | ---- | ------------ | ------ |
| POST | `/forecast` | `ForecastPostController` | `ForecastRiskCommandHandler`（step4-2）→ 202 / 生成結果 |
| GET | `/forecast` | `ForecastGetController` | 最新 `RiskForecast` を返す（read-model） |

- `routes/forecastRoutes.ts` を追加し `routes/index.ts` に登録。既存ルートはノータッチ。
- 出力の `risks[]` は引用検証済み（step4-2 手順5）。Controllerは整形のみ。

### DI 追記（BackofficeApp.ts）

- read-only 依存を new して `ForecastRiskCommandHandler` を Bus 登録:
  `GitHubGateway`（`listOpenPullRequests` 追加済み）/ `TerraformGateway`（`getPendingPlan` 追加済み）/ `ScheduleSource` / `ForecastMemoryRepository` / `ForecastPort`（★差し替えポイント＝ `GeminiForecastAdapter`）。
- 起動時に `ForecastMemoryRepository.warmUp()`（Resolved から subject 投影）。`SimilarIncidentRepository.warmUp()` と同じ起動フックに並べる。
- **write は発生しない**（全Gateway read-only）。リメディエーションが要る場合のみ既存 `RemediationPort`（人間承認ゲート）を再利用。

### Schedule ソース（seed）

- `ScheduleSource` の実装は seed（JSON/config）で開始。本番は将来カレンダー/負荷予測連携に差し替え（interface維持）。
- `DEMO_ENABLED` 配下で seed スケジュールを投入し、デモシナリオ6を再現可能にする。

### config 追記

- `FORECAST_ENABLED`（予兆機能のトグル・既定 off で本番非侵食）/ `FORECAST_HORIZON`（既定 "今週末"）を追加。

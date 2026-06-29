# 設計エージェント向けプロンプト v19.1

> **変更履歴（v18→v19）**
> 検知境界（detection boundary）を明文化。検知基盤に Cloud Monitoring を採用（Datadog 不採用＝有料・物語矛盾／Cloud Monitoring は無料枠・GCP 要件加点）。
> 検知ソースを peer な ingest アダプタ化（`CloudMonitoringAlertIngestController`・`POST /ingest/cloud-monitoring` 実装）。EC 自前イベントは Datadog 不在のデモ stand-in と位置づけ。
> 検知の被り対策3層（category オーナーシップ／dedupKey＋occurrenceCount／AI 相関委譲）。`MonitoringEvent.dedupKey()`・`Alert.occurrenceCount`・`AnalyzeAlert` dedup を実装。詳細は `docs/step4-1-strategy.md` §2.5。
>
> **変更履歴（v11→v12）**
> インフラ横断調査パイプラインを設計に追加。
> AlertClassifier（Elastic類似検索）とインフラ横断調査のシナジー構造を明文化。
> 実装TODOの優先順位フローを追記。
> インフラ調査関連APIエンドポイントを追加。
>
> | Step                                 | 詳細設計ドキュメント                                                                  | ステータス      |
> | ------------------------------------ | ------------------------------------------------------------------------------------- | --------------- |
> | Step 1: ディレクトリ構成             | `docs/step1-directory-structure.md`                                                   | ✅ 確定         |
> | Step 2: ドメインモデル設計（EC）     | `docs/step2-domain-model.md`                                                          | ✅ 確定         |
> | Step 3: アプリケーション層設計（EC） | `docs/step3-application-layer.md`                                                     | ✅ 確定         |
> | Step 4: Monitoring（4分割）          | `docs/step4-1-strategy.md` 〜 `step4-4-backoffice-frontend.md`（各 `*-todo.md` 付き） | ✅ 確定         |
> | Step 5: ADR                          | `docs/step5-adr.md`                                                                   | 🔲 次のステップ |

---

## あなたの役割

あなたはシニアソフトウェアアーキテクトです。
以下のコンテキストと制約を読み込み、設計フェーズのアウトプットを順番に生成してください。
実装コードは出力しないでください。設計が確定してから別セッションで行います。

---

## プロジェクト概要

### 目的

ECドメイン（注文・在庫）で発生する障害を、AIエージェントがリアルタイムに分析・分類し、バックオフィスダッシュボードへレポートするシステム。

AIエージェントは「アプリログを見る」だけでなく、**Cloud Logging・Terraform差分・GitHubコミット履歴を横断して証拠を自律的に収集し、過去の障害パターンと照合して原因を推定する**DevOps AIエージェントとして機能させる。

### ハッカソン要件（必須）

- Google Cloud アプリケーションプロダクトを1つ以上使用（Compute Engine採用）
- Google Cloud AI技術を使用（**Gemini API必須**。Claude/GPT-4は使用禁止）
- Findy DevOps × AI Agent Hackathon 2026 出展用

### ハッカソンGCP要件の充足戦略

**要件1（アプリ実行）**: Compute Engine（e2-medium × 1）で充足。選択肢に明示されており完全適合。

**要件2（AI技術）**: 以下の3フェーズで段階強化する。

| フェーズ                    | 実装                                          | 充足状況                                      | 備考                         |
| --------------------------- | --------------------------------------------- | --------------------------------------------- | ---------------------------- |
| ハッカソン本体              | Gemini API直接（`@google/generative-ai`）     | ✅ Gemini API                                 | 要件最低ラインを確実に満たす |
| フェーズ1（完成後）         | Vertex AI SDK経由（`@google-cloud/vertexai`） | ✅✅ Gemini API（Vertex AI推奨経路）          | 審査員評価が上がる           |
| フェーズ2（ポートフォリオ） | ADKエージェント構成                           | ✅✅✅ Gemini Enterprise Agent Platform + ADK | 2項目達成                    |

> **重要**: 各フェーズの切り替えは `AIInvestigationPort` 実装クラスのDI差し替えのみ。
> `InvestigateAlertOnAlertClassifiedUnknown`（Application層）は完全にノータッチ。

---

## 技術スタック

| カテゴリ             | 技術                                                                               | 備考                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Language             | TypeScript                                                                         | Strict mode                                                                                                                 |
| Framework            | Express.js                                                                         | バックエンドAPI                                                                                                             |
| Frontend             | React（CSR）                                                                       | バックオフィスUI。SSR/ISR不使用                                                                                             |
| Architecture         | DDD + CleanArchitecture + CQRS + EDA                                               | CodelyTVパターン準拠                                                                                                        |
| Message Broker       | RabbitMQ                                                                           | DomainEvent配信                                                                                                             |
| Database             | MongoDB                                                                            | 全コンテキスト統一（ハッカソンスコープ）                                                                                    |
| AI（現行）           | Gemini API                                                                         | `@google/generative-ai`。ハッカソン本体で使用                                                                               |
| AI（将来P1）         | Vertex AI SDK                                                                      | `@google-cloud/vertexai`。フェーズ1で差し替え                                                                               |
| AI（将来P2）         | ADK（Agents Development Kit）                                                      | フェーズ2でマルチエージェント構成                                                                                           |
| 検索（将来P1）       | Elasticsearch（Elastic Cloud）                                                     | `SimilarPatternRule`（kind=SIMILARITY）として `ApplicationClassificationPolicy` に追加。a2aは不使用（ADK in-processで代替） |
| Observability        | Cloud Logging・Cloud Monitoring・Cloud Trace                                       | GCPネイティブ。OTel SDK（`@opentelemetry/sdk-node`）からGCPエクスポーター経由で直接送信。Collectorコンテナ不使用            |
| Logging              | OTel Logs → Cloud Logging（`@google-cloud/opentelemetry-cloud-trace-exporter` 等） | Winston不使用。OTel一括化でtrace_id/span_idはSDKが自動付与。`StructuredLog`型には含めない                                   |
| インフラ調査         | Cloud Logging API・Terraform CLI（読み取り専用）・GitHub REST API                  | インフラ横断調査エージェントが証拠収集に使用。apply等の書き込み操作は一切行わない                                           |
| CI/CD                | GitHub Actions                                                                     | 「まわす」。Trivy / npm audit を実行し脆弱性を `MonitoringEvent(SECURITY)` として通知（v13）                                |
| セキュリティ         | Trivy・npm audit                                                                   | CIでHIGH以上の脆弱性を検出。調査パイプラインのSECURITYカテゴリ入力（v13）                                                   |
| リメディエーション   | GitHub Pull Request API（write）                                                   | `RemediationPort` 経由でPR草案のみ起票。自動マージなし・人間承認ゲート（v13）                                               |
| デプロイ（とどける） | Cloud Run（一部）＋ Compute Engine                                                 | 「とどける」の見せ場をCloud Runに載せる。EDA常駐Subscriberとステートレス性のトレードオフはADRで整理（v13）                  |
| Test                 | Vitest (BDD)                                                                       |                                                                                                                             |
| Infra                | GCP Compute Engine (e2-medium × 1)                                                 |                                                                                                                             |

---

## 参照リポジトリ（設計の規約・パターンの拠り所）

**CodelyTV typescript-ddd-example**
URL: https://github.com/CodelyTV/typescript-ddd-example

このリポジトリをクローンまたはブラウズし、以下のパターンを必ず踏襲すること。

### 参照すべき構造・規約

```
src/
├── Contexts/
│   ├── Shared/
│   │   ├── domain/
│   │   │   ├── AggregateRoot.ts       ← 必ず継承元として使用
│   │   │   ├── DomainEvent.ts         ← イベントの基底クラス
│   │   │   ├── EventBus.ts            ← インターフェース定義
│   │   │   ├── ValueObject/           ← Value Objectの基底
│   │   │   └── criteria/              ← 検索条件の抽象化（そのまま流用）
│   │   └── infrastructure/
│   │       ├── EventBus/RabbitMq/
│   │       └── persistence/criteria/
│   ├── Mooc/                          ← ECコンテキストの参考元
│   └── Backoffice/                    ← Monitoringバックオフィスの参考元
└── apps/
    ├── mooc/backend/
    └── backoffice/backend/
```

### 踏襲するパターン（コードを読んで確認すること）

1. **AggregateRoot**: `record()` でDomainEventを蓄積し、`pullDomainEvents()` で取り出す
1. **DomainEvent**: `EVENT_NAME`静的プロパティ、`fromPrimitives()` / `toPrimitives()` を必ず実装
1. **Value Object**: プリミティブをラップ、イコール比較を持つ
1. **ApplicationService**: メソッド名は `run()` で統一（CodelyTV準拠）
1. **CommandHandler**: `CommandHandler<T>` インターフェースを実装
1. **Repository**: インターフェースをdomainに、実装をinfrastructureに配置
1. **RabbitMQ**: Subscriber登録、Queue命名規則（`{appName}.{eventName}.{subscriberName}`）、Failover Publisher
1. **DI**: コンストラクタ手動注入（Poor Man's DI）。`EcBackendApp.ts` の `start()` で依存関係を手動で組み立てる。`node-dependency-injection` は使用しない。インターフェース注入による差し替えやすい構造は維持すること

---

## コンテキスト構成（設計対象）

> **ディレクトリ構成の詳細は `docs/step1-directory-structure.md` を参照**
> **ドメインモデルの詳細は `docs/step2-domain-model.md` を参照**
> **アプリケーション層の詳細は `docs/step3-application-layer.md` を参照**
> **Monitoringコンテキストの詳細は `docs/step4-2-monitoring-context.md` を参照（戦略は `step4-1`、backendは `step4-3`、frontendは `step4-4`）**

```
src/Contexts/
├── EC/
│   ├── Orders/
│   ├── Inventory/
│   └── Shared/
├── Monitoring/
│   ├── AlertAnalysis/
│   ├── AIInvestigation/               ← 実体は infrastructure 配下に内包（下記）
│   │   ├── infrastructure/infrainvestigation/ ← インフラ横断調査（read-only Gateway群）【実装済み】
│   │   ├── infrastructure/remediation/        ← 自律リメディエーション（PR起票のwrite隔離）【実装済み】
│   │   └── infrastructure/adk/        ← ADKマルチエージェント（a2a不使用）【実装済み】
│   ├── Forecast/                      ← 予兆（stretchⅡ）【未実装・設計のみ】
│   ├── EventLog/                      ← イベントソーシング基盤（stretchⅢ）【未実装・設計のみ】
│   └── ReportGeneration/             ← 【未実装・設計のみ。レポート生成は AlertAnalysis/GetAlertReport が担当】
└── Shared/
```

---

## ECドメインのイベントフロー

```
POST /orders
  ↓ PlaceOrderCommand
PlaceOrderCommandHandler
  ├─ PaymentGateway.run()
  │   └─ 失敗 → PaymentTimeoutDomainEvent → Monitoring
  └─ Order.place()
       └─ OrderPlacedDomainEvent

RabbitMQ
  ├─ ReserveInventoryOnOrderPlaced
  │    └─ All-or-Nothing引き当て（2フェーズ）
  │         ├─ 成功 → InventoryReservedDomainEvent
  │         └─ 失敗 → InventoryReservationFailedDomainEvent
  ├─ CompensateOrderOnInventoryFailed → OrderをFAILEDに遷移
  └─ CollectMonitoringEventOnECEventPublished → AlertAnalysis → AI分析 → SSE push
```

---

## 検知境界と検知ソース（v19追加）

「Datadog の上に乗る」と言いながら検知層を自前で持つ矛盾を解く。**検知（dedup/相関/grouping/閾値発火）は上流の責務＝境界の外**。`MonitoringEvent` は「発火済み／検知済みの事象」を表し、検知ソースは peer な ingest アダプタで合流する。

- **検知基盤 = Cloud Monitoring**（Datadog 不採用。有料・物語矛盾 ↔ Cloud Monitoring は無料枠・GCP 要件加点・設計済み）。
- ingest アダプタ（すべて同じ観測パイプラインに合流）:
  - `CollectMonitoringEventOnECEventPublished`（EC 自前 DomainEvent → APPLICATION）＝**Datadog 不在のデモ stand-in**
  - `CloudMonitoringAlertIngestController`（`POST /ingest/cloud-monitoring` → INFRASTRUCTURE/CAPACITY）
  - `SecurityScanIngestController`（CI/Trivy → SECURITY・設計）
- **検知の被り対策（3層）**:
  - (a) **category オーナーシップ**: APPLICATION は EC イベント、INFRASTRUCTURE/CAPACITY は Cloud Monitoring が権威。同じものを両者に監視させず被りを構造的に消す。
  - (b) **dedupKey ＋ occurrenceCount**: 同一 dedupKey（`source::category::eventName`）の未解決 Alert は新規作成せず発生回数を加算（UI は「×N」）。アラート嵐・重複表示を抑制。`AnalyzeAlertUseCase` の classify 前で判定。
  - (c) **異症状・同一根本原因**は dedup でなく AI 調査の相関に委譲（エンジン化しない・ADR）。
- 詳細・ADR は `docs/step4-1-strategy.md` §2.5 を参照。

---

## インフラ横断調査パイプライン（v12追加）

### 概要と設計思想

AIエージェントは「アプリログのみを見る分類器」ではなく、**複数のインフラ情報ソースを自律的に横断して証拠を収集し、根拠付きで原因を推定する調査エージェント**として機能する。

これはElastic類似検索（AlertClassifier）と競合しない。**役割が異なる2レイヤー**が調査パイプラインを形成するシナジー関係にある。

```
Alert発生
  ↓
【レイヤー1：証拠収集】InfraInvestigationAgent
  ├─ Cloud Logging API  → アプリログの収集
  ├─ Terraform CLI      → plan / state / git diff（読み取り専用）
  └─ GitHub REST API    → 直近のコミット・PR一覧

  ↓ 収集した「障害コンテキスト」がリッチになるほど

【レイヤー2：事例照合】AlertClassifier（SimilarPatternRule・Elastic）
  └─ ハイブリッド検索（BM25 + ベクトル）で過去パターンと突合

  ↓
【レイヤー3：AI推定】AIInvestigationPort（LLMInvestigationAdapter ＋ GeminiLLMClient）
  └─ 収集した証拠 + 照合結果を統合してGeminiに渡し、原因候補ランキングを生成
```

**シナジーの本質**: インフラ横断調査がElasticの入力（障害コンテキスト）を多次元に太らせることで、類似検索の精度が上がる。アプリログだけをクエリにするより、「アプリログ + Terraform差分 + GitHubコミット」を合わせた文脈でベクトル検索する方が照合精度が高い。

### インフラ調査の設計原則（必ず守ること）

- Terraform・GitHub・Cloud LoggingはすべてGatewayインターフェース経由でアクセスする（`TerraformGateway` / `GitHubGateway` / `CloudLoggingGateway`）
- **読み取り専用に徹する。`terraform apply` 等の書き込み操作は一切実装しない**
- 各Gatewayの実装はInfrastructure層に閉じ込め、Domainは依存しない
- `InfraInvestigationPort`（インターフェース）を設け、Application層は抽象にのみ依存する
- 調査結果は `InfraEvidence` 型に正規化してから `AIInvestigationPort` に渡す（生レスポンスをそのまま渡さない）

### 調査対象ソースと優先順位

| 優先度 | ソース           | 取得内容                                     | ゲートウェイ             | ハッカソン必須 |
| ------ | ---------------- | -------------------------------------------- | ------------------------ | -------------- |
| 必須   | Cloud Logging    | アプリログ（エラー・警告）                   | `CloudLoggingGateway`    | ✅             |
| 必須   | Terraform        | `terraform plan` / `git diff`（IaC変更履歴） | `TerraformGateway`       | ✅             |
| 高     | GitHub REST API  | 直近コミット・PR一覧                         | `GitHubGateway`          | ✅（できれば） |
| 中     | Cloud Monitoring | CPUやメモリ等のメトリクス相関                | `CloudMonitoringGateway` | 🔲 次フェーズ  |
| 低     | Cloud Trace      | 分散トレース                                 | `CloudTraceGateway`      | 🔲 次フェーズ  |

Cloud Monitoring・Cloud Traceは「設計済み・次フェーズ実装」としてADRに明記する。

### InfraEvidence 型の設計方針

```typescript
// Domainオブジェクト（Infrastructure層の型を持ち込まない）
interface InfraEvidence {
  appLogs: AppLogEntry[]; // Cloud Loggingから収集したエラーログ
  terraformDiff?: TerraformDiff; // Terraform差分（変更があった場合のみ）
  recentCommits?: GitCommit[]; // 直近のコミット一覧
  collectedAt: Date;
}
```

### バックオフィスUIでの表示方針

インフラ調査結果は `/alerts/:id` の詳細画面で「証拠一覧」として表示する。審査・デモにおいて**AIが複数ソースを横断して証拠を積み上げていく過程を可視化**することがこのレイヤーの最大の価値。

```
[バックオフィス /alerts 画面]
  ├─ アラートカード（既存）
  │    └─ AI分析結果（原因候補・確信度）をインライン表示
  └─ 証拠パネル（v12追加）
       ├─ Cloud Logging: "DB接続失敗 × 47件"
       ├─ Terraform:     "昨日 Cloud SQL 接続設定変更あり"
       └─ GitHub:        "PR #123 merged 2h ago: update db config"
         ↓
       AI推定: "Terraform変更による接続設定不整合の可能性 82%"
```

### デモシナリオへの追加（シナリオ4）

```
シナリオ4：インフラ変更起因の障害（Terraform差分検出）

1. Terraformで設定変更済みの状態でアプリを起動
2. 障害Alertが発生
3. InfraInvestigationAgentが自律的に調査を開始
   ├─ Cloud Logging: "DB接続失敗" を検出
   ├─ Terraform:     "cloud_sql_database_instance の接続設定が変更されている" を検出
   └─ GitHub:        "直近コミットにDB設定ファイルの変更あり" を検出
4. 収集した証拠をElasticで過去パターンと照合
5. バックオフィスに証拠一覧 + AI推定結果をSSEでリアルタイム表示
   「Terraform変更後から502増加。接続設定不整合の可能性82%」
```

---

## 実装TODOの優先順位（v12追加）

ハッカソン締切（7/10）から逆算した実装順序。各ステップは前ステップ完了が前提条件。

```
【フェーズ0：提出ライン確保】
  Step1-EC:       ECドメイン（注文・在庫）の基本フロー実装
  Step1-Monitor:  MonitoringコンテキストのAlertAnalysis + SSE push
  Step1-Classify: KnownPatternRule（first-match）+ Policy/Sorter 実装
  Step1-Gemini:   LLMInvestigationAdapter ＋ GeminiLLMClient（Gemini API直接）実装
  Step1-Demo:     デモシナリオ1・2・3がE2Eで通る
  → ✅ コミットを切り「提出できる状態」をキープ

【フェーズ1：インフラ横断調査（最優先の差別化）】
  Step2-Infra-a:  CloudLoggingGateway 実装（アプリログ収集）
  Step2-Infra-b:  TerraformGateway 実装（plan/diff 読み取り専用）
  Step2-Infra-c:  GitHubGateway 実装（直近コミット・PR）
  Step2-Infra-d:  InfraEvidence 正規化 → Geminiプロンプトに統合
  Step2-Infra-e:  バックオフィスに「証拠パネル」追加
  Step2-Demo:     デモシナリオ4がE2Eで通る
  → ✅ コミットを切る

【フェーズ2：Elastic類似検索（シナジー完成）】
  Step3-Elastic-a: Elastic Cloud セットアップ（公式サイトから登録）
  Step3-Elastic-b: SimilarPatternRule 実装（hybrid search・Policy に追加）
  Step3-Elastic-c: インフラ証拠（InfraEvidence）をElastic検索クエリに統合
                   ← これがシナジーの本丸。証拠が太るほど照合精度が上がる
  → ✅ コミットを切る

【フェーズ3：Vertex AI / ADKマルチエージェント移行（ポートフォリオ強化）】
  Step4-Vertex:   VertexLLMClient 実装（LLMInvestigationAdapter への LLMTextClient 差し替えのみ）
  Step4-ADK-a:    ADKAgentInvestigationAdapter（Coordinator起動）実装
  Step4-ADK-b:    EvidenceCollector / RootCauseAnalyst / RemediationPlanner サブエージェント実装
  Step4-ADK-c:    自律的な証拠追加収集ループ（analystが収集対象を判断）を実装
                  ← a2aは使わない。1プロセス内のADKサブエージェント構成
  → AIInvestigationPort のDI差し替えのみ。InvestigateAlertOnAlertClassifiedUnknown ノータッチ

【フェーズ4：予兆ブリーフィング（stretchⅡ・reactive → proactive）】
  ← フェーズ0〜3 ＋ シナリオ5 ＋ GCP実機が全部着地してからのcapstone
  Step5-Forecast-a: ForecastSignal / RiskForecast / Schedule ドメイン型追加（新規・既存無傷）
  Step5-Forecast-b: ForecastMemory projection（突合キーB）+ InvestigationReport に optional subject 追記
  Step5-Forecast-c: Gateway 未来シグナルメソッド追加（listOpenPullRequests / getPendingPlan・read-only維持）
  Step5-Forecast-d: ForecastPort + GeminiForecastAdapter（citations必須強制・引用検証）
  Step5-Forecast-e: ForecastRiskCommandHandler（ForecastSignalSource[] でシグナル収集→正規化→LLM→引用検証・write無し）
                    ★継ぎ目: 源は ForecastSignalSource IF 越し。stretchⅢで event-log 源を1個足すだけにする
  Step5-Forecast-f: POST /forecast・GET /forecast ＋ DI追記・ScheduleSource seed
  Step5-Forecast-g: ForecastPage + RiskCard + CitationList（引用チップ＝体験の肝）
  Step5-Demo:       デモシナリオ6（seed→予兆生成→引用付きリスク）を録画

【フェーズ5：ログベース・イベントソーシング基盤（stretchⅢ・予知ビュー）】
  ← フェーズ4（予兆＝既知シグナル×記憶）の上に、DDIA unbundling の event log 基盤を敷く。
    実装はハッカソン後。設計・ADR は今固める（前倒し実装はしない＝薄い／障害寄りの現行DomainEventでは予兆の母集団が不足しデモ価値が出ないため）。
  Step6-ES-a: EC ドメインイベント拡張（正常系の業務イベントを増やす＝予兆の母集団を太らせる）
  Step6-ES-b: EventLog 追記 sink（全 DomainEvent を append-only に蓄積。障害専用でなく一次資料）
  Step6-ES-c: ForecastMemory projection の上流を Mongo(Resolved) → event log に差し替え（consumer はノータッチ）
  Step6-ES-d: EventLogPrecursorSource implements ForecastSignalSource（直近イベント列→予兆シグナル。源を1個足すだけ）
  Step6-ES-e: 予知ビューを Forecast に合流（統計MLでなく LLM に event-log 文脈を渡す＝相関の検出。因果は研究フロンティアとして ADR）
```

> **フェーズ1.5（DevOpsループ：CI/CDセキュリティ）— 差別化として優先度高**
> 「DevOps × AI Agent」のDevOps半分を担う。フェーズ1（InfraInvestigation / GitHub Gateway）完成後に着手できる。
>
> ```
> Step-CI-a:   GitHub Actions に Trivy / npm audit を組み込む
> Step-CI-b:   POST /ingest/security-scan → MonitoringEvent(SECURITY) → AnalyzeAlert 合流
> Step-CI-c:   RemediationPort / GitHubPullRequestGateway 実装（PR草案起票・人間承認ゲート）
> Step-CI-d:   バックオフィスにCVEレポート + 修正PR + 承認ボタンを表示
> Step-CI-Demo: デモシナリオ5がE2Eで通る
> ```

> フェーズ1（インフラ横断）とフェーズ2（Elastic）は直列で実装する。
> フェーズ1が完成してからフェーズ2に入ることで、ElasticへのクエリをInfraEvidenceで強化できる。
> 途中で締切が来てもフェーズ0の状態で提出できる。

---

## デモシナリオ（設計に反映すること）

### シナリオ1：既知障害（決済サービスタイムアウト）

```
0. デモドロワーで決済モードを「常にタイムアウト」に切り替え
1. 注文APIを叩く（Swagger UI or curl）
2. PaymentMockGatewayがTimeoutを返す
3. PaymentTimeoutDomainEvent → RabbitMQ → Monitoring
4. 1秒以内にバックオフィスにSSEでリアルタイム表示
```

### シナリオ2：未知障害（DBコネクション枯渇）

```
1. 複数サービスで連鎖エラー発生
2. Monitoringが既知パターン不一致と判断
3. Gemini APIにコンテキストを送信（トークン上限3,500）
4. 「DBコネクションプール枯渇の可能性87%」をバックオフィスに表示
```

### シナリオ3：フィードバックによる学習

```
1. シナリオ2の分析結果に「正解」フィードバック
2. 正解フィードバックがAUTO_PROMOTE_THRESHOLD回に到達
3. 未知パターンが既知パターンに自動昇格
4. 次回同じ障害が1秒以内に既知分類される
```

### シナリオ4：インフラ変更起因の障害（v12追加）

```
1. Terraformで設定変更済みの状態でアプリを起動
2. 障害Alertが発生
3. InfraInvestigationAgentが自律的に調査
   ├─ Cloud Logging: エラーログを収集
   ├─ Terraform:     IaC変更差分を取得
   └─ GitHub:        直近コミットを取得
4. 収集した証拠をElasticで照合（フェーズ2以降）
5. バックオフィスに証拠一覧 + AI推定結果をSSEでリアルタイム表示
```

### シナリオ5：CI/CD連携のセキュリティインシデント（DevOpsループ・v13追加）

「DevOps × AI Agent」の DevOps 半分を担うフロー。調査(read)とリメディエーション(write)の分離原則のもと、**AIが調査し修正PRを起票、人間がレビュー・承認**する。

> **デモ実演の2経路（2026-06-29 整理）**:
>
> - **デモ卓 合成シナリオ5（脆弱性検知）**: DEMO CONSOLE のボタン押下で `TriggerDemoScenarioUseCase` が `SecurityScanTranslator`→`CollectMonitoringEventUseCase`（= 実 `/ingest/security-scan` と同一の変換・分類・調査経路）に合成ペイロードを直接通す。即時・確実で INITIALIZE DEMO で戻る。シナリオ1〜4と同じ「backend 経路を持つ合成注入」（偽ボタンではない）。ライブ実演はこちらを使う。
> - **本物のCI証明（別役割）**: 実在依存を既知CVE版に pin した PR → 実 Trivy → 実 ingest。最も忠実だが、`ci.yml` は現状 `on: push: branches:[main]` のみで **PR では発火せず main merge の push でのみ走る**（PR時点で出すなら `pull_request:` トリガ追加が必要）。さらに `INGEST_URL`/`INGEST_TOKEN` + デプロイ済み到達可能 backend + 実在 HIGH/CRITICAL が揃って初めて検知が成立。レポート/PR の実リンクはライブでは出せない割り切り（実演コスパ優先）で、ナレーションで明示する。

```
1. GitHub Actions（CI）が Trivy / npm audit を実行
2. HIGH以上の脆弱性を検出 → POST /ingest/security-scan で backoffice へ送信
3. SecurityScanIngestController が MonitoringEvent(category=SECURITY) を構築
   ※ ECDomainEvent由来ではない。MonitoringEventがECと疎結合である設計の実証
4. 既存の AnalyzeAlert → InvestigateAlert（ADKマルチエージェント）に合流
   ├─ EvidenceCollector: GitHub Gatewayで利用箇所・依存グラフを収集
   ├─ RootCauseAnalyst(security): CVE概要 / 影響範囲 / 修正版を分析
   └─ RemediationPlanner: 修正方針 → RemediationPort.draftPullRequest()（write・人間承認ゲート）
5. バックオフィスにCVEレポート + 修正PRのURLをSSE表示
6. 人間が PR と reviewStatus をレビュー・承認/却下（自動マージはしない）
```

> リメディの実行は2モード（`RemediationExecutor` で差し替え、`config.remediation.mode`）:
>
> - **advisory**（既定・CI不要）: in-process で方針テキストのみ生成し `SECURITY_REMEDIATION.md` の草案PR。実コードは直さない（人間が直す前提）。
> - **dispatch**（agentic・本命）: `repository_dispatch(ai-remediation)` で GitHub Actions（`.github/workflows/ai-remediation.yml`）へ投げ、**ランナー上でAIエージェント(Gemini CLI/差替可)が実コード修正→trivy再スキャン+UT/E2E が緑→draft PR**。**修正精度はテストゲートで担保**（APIサーバ内では実コードを書かない）。非同期のため起票時は `dispatched`、CI完了時に `POST /ingest/remediation-result` で `drafted`/`failed` に確定。過去のローカル版（Trivyローカルスキャン+Copilot Agent プロンプト）の CI/CD 化に相当。
>
> このシナリオで「つくる（調査エージェント）・まわす（GitHub Actions/CI）・とどける（デプロイ）」の3コンセプトを1ループで踏む。write 操作（PR起票/コミット）は `RemediationExecutor` の裏（in-process は `RemediationPort`、agentic は CI ランナー）に隔離し、本番への直接 write はしない。
>
> リメディの自己修正ループは `REMEDIATION_MAX_ATTEMPTS`（既定2）で必ず打ち切る（無限リトライ＝課金暴走の安全弁）。
>
> 〔将来P1〕dispatch＋検証ループの **AI調査**への展開構想あり（`step4-3` タスク16・未実装）。ただし「障害＝コードデグレ＝コード修正」は誤りで、根本原因カテゴリにより修正ターゲット（アプリのコード→PR+UT / 自前IaC→Terraform PR+`terraform plan` / 外部起因→runbook+エスカレーション・自動修正対象外）と検証ゲートが変わる。設計の中心は検証ループでなく **修正ターゲットのルーティング**。トークン多消費＋上限必須のため効果見極め後に着手。

### シナリオ6: 構成変更障害（IaC apply 起因・v14追加）

**「terraform apply（IaC 変更）そのものが原因の障害」を、AI が apply 適用差分を root cause として特定する**フロー。シナリオ4（インフラ障害）が GCP の Cloud Monitoring 経路B 依存で**ローカルでは Alert が出ない**のに対し、本シナリオは検知の入口だけ合成して実 ingest 経路に通すので**ローカルでも実 Alert→AI 調査が走る**（シナリオ5＝脆弱性検知と同方式）。

> **設計のキモ（2026-06-29）**: メトリクス/ログ/コミットは事後に時間窓でライブ照会できるが、**terraform apply の差分だけは後から再構成できない**（apply は CI 上の一回限りのイベント）。よって git join ではなく**適用の瞬間にイベントとして捕捉して保存**し、調査は既存の `since` 時間窓で引く（検知ソースの peer ingest と同じ思想）。git sha は join キーでなく apply イベントの一属性。証拠 `TerraformDiff` は「変更ファイル名の羅列」ではなく**リソース単位の構造化差分**（address / action / `attributeDeltas: {key, before, after}`）に格上げ済み＝AI 原因分析の決定打になる（タスク33）。

```
1. terraform apply で Cloud SQL の設定が縮小される
   （tier db-custom-2-7680→db-f1-micro / max_connections 100→20）
   → apply の瞬間に AppliedInfraChangeStore へ構造化差分を記録
   （実機: CI の apply パイプラインが `terraform show -json` を ingest／デモ: 合成）
2. その変更が原因で DB インスタンスが不安定化 → INFRASTRUCTURE Alert が発生
3. InfraInvestigation が自律的に証拠収集
   ├─ Terraform: 障害直前（時間窓内最新）の apply 差分を取得＝root cause
   │             google_sql_database_instance.main update
   │               settings.tier:            db-custom-2-7680 → db-f1-micro
   │               …database_flags.max_connections: 100 → 20
   ├─ Cloud Monitoring: CPU/接続数などのメトリクス相関（INFRASTRUCTURE/CAPACITY時）
   └─ Cloud Logging:    エラーログ
4. バックオフィスに証拠（apply 差分の before→after）+ AI推定をSSE表示
```

> **デモ卓 合成シナリオ6（構成変更障害）**: DEMO CONSOLE のボタン押下で `TriggerDemoScenarioUseCase` が ① 代表 apply 差分を `AppliedInfraChangeStore.record()` → ② 合成 Cloud Monitoring webhook を `CloudMonitoringAlertTranslator`→`CollectMonitoringEventUseCase`（= 実 `/ingest/cloud-monitoring` と同一の変換・分類・調査経路）に通す。**検知の入口のみ合成**で、変換→分類→AI 調査（terraform 差分の収集）は実経路。INITIALIZE DEMO で戻る。
> 分類の罠: 調査が terraform 差分を引くのは category===**INFRASTRUCTURE** のときだけ（`DefaultInfraInvestigationAdapter`）。translator の `CAPACITY_HINTS`（connection/pool/cpu…）に当たると CAPACITY になり差分を引かないので、condition 名は容量語を避けて INFRASTRUCTURE に倒す（UTで固定）。
> **「合成入力」の明示**: シナリオ5/6 は FAULT INJECTION 上で amber バッジ＋凡例を出す＝「検知の入口のみ合成。変換→AI調査→PR起票は実経路。本番は実 CI/apply から同経路。外部リンク（PR/コンソール）はデモ環境では代表値」。パイプラインは実際に動くため「動かない偽物」とは括らず、軸は「入口が合成か実外部ソースか」「外部リンクが代表値か実リンクか」で正確に示す（タスク34）。

### シナリオ7：アプリコード退行（CIは通ったが挙動デグレ・v20追加）

**「テストは緑のまま通ったアプリコード変更そのものが挙動を退行させた障害」を、AI が実コミット差分を読んで root cause として特定する**フロー。シナリオ4/6（インフラ・IaC 起因）・5（CVE）がカバーしない**アプリコード起因**の根本原因カテゴリを埋め、既述の「修正ターゲット・ルーティング（アプリのコード→PR+UT / 自前IaC→Terraform PR / 外部→runbook）」を実証する。`GitHubGateway.getCommitDiff()`（コミット単位の実 unified diff 取得・タスク35）の見せ場。

> **設計のキモ（2026-06-29）— 証跡を「代表値」から「本物」へ一段上げる**: 「成果物が本物」と「本番にデプロイされている」は別の軸。原因コミットは**実在の git コミット**（demo 隔離ブランチ上）で、AI は `fetch_recent_commits`→`fetch_commit_diff` で**本物の差分**を引いて分析し、修正は**事前生成した実 draft PR**にリンクする。合成は検知の入口（Alert 発火）のみ＝シナリオ5/6 と同じ「正直な合成」の延長。評価者が「適当に言ってる」と疑うのは*サービスが実際にクラッシュしなかったから*ではなく*差分やPRが本物でない／クリックできないから*。直すべきはそっちで、それは安全に本物化できる。
>
> **なぜ main でなく demo ブランチを調査するか**: `ci.yml` は `on: push: branches:[main]` で push→build→deploy(Cloud Run/GCE 再起動)まで走る。原因コミットを main に積むと **live demo サービスが実際に壊れ、他シナリオまで人質**。よって「デプロイ経路（main）」と「証跡コミット（`demo/regression-*`）」を物理的に切り離す。本番では deployed ref（=main）を調査する物語だが、デモでは live を汚さないため退行を隔離ブランチに置き、AI が読むのは**実コミット・実差分**。**「main に入れて実デプロイ」は非推奨**＝デモ全体が人質になり、得る信頼は実差分+実ログ+実PRの上にほぼ上乗せしない。
>
> **実装（タスク35・完了）**: ① 調査対象 ref は use case 引数でなく **`GITHUB_TARGET_REF` env**（`config.github.targetRef`→`GitHubGatewayImpl`）。アプリ層は一切汚さない。本番は未設定＝既定ブランチを `since` で時間窓フィルタ／**デモは `demo/regression` を指す**。② **ref 固定時は `listRecentCommits` が tip コミットを `since` 無しで返す**＝静的に1回積んだ証跡コミットを審査員がいつ閲覧しても壁時計非依存で発見できる（**1次審査の非同期閲覧に対応・直前の再仕込み不要**）。③ `DefaultInfraInvestigationAdapter` の commit 収集 gating に **APPLICATION を追加**（SECURITY と並ぶ「直近コミットが原因候補」カテゴリ）。④ 証跡仕込みは **`scripts/stage-demo-branch.sh`**（main から `demo/regression` を作り `SubtotalAmount` に丸め誤りを実コミット。デプロイされない）。⑤ **前提: 差分は `fetch_commit_diff` ツールで引くため ADK パス（`useAdk`）が要る**（単一Gemini 事前収集は commit 一覧のみ＝差分は InfraEvidence に載せない設計）。

```
事前準備（1回・デモ前）:
  - demo/regression-* に症状と整合する実バグコミットを1個積む
    （例: checkout 合計の丸め誤り／在庫デクリメント条件式ミス など、diff から原因が読める変更）
  - main 不変＝CI/deploy 不発火・live サービス無傷。コミット sha と症状ログを scenario7 ペイロードに整合
  - 修正案の実 draft PR を事前生成しておく（advisory もしくは dispatch・draft ゆえマージ不要）

ライブ:
1. DEMO CONSOLE でシナリオ7押下 → TriggerDemoScenarioUseCase が APPLICATION category の
   Alert を合成注入（実 ingest 経路）。同時投入する appLogs は当該バグの症状
2. AnalyzeAlert → InvestigateAlert（ADKマルチエージェント）が実走
3. EvidenceCollector: fetch_recent_commits(since, ref=demoブランチ) → 本物のコミット一覧から疑わしい sha を発見
                     fetch_commit_diff(sha)                      → 本物の unified diff を取得
4. RootCauseAnalyst: 差分と症状ログを相関 → 「このコミットの該当変更が原因」
5. RemediationPlanner: 事前生成済みの実 draft PR にリンク（修正ターゲット=アプリのコード→PR+UT）
6. バックオフィスに「実差分 before→after + AI原因特定 + 実PRリンク」を SSE 表示
```

> **「合成入力」の明示**: シナリオ5/6 と同じ amber バッジ＋凡例に1行足す＝「検知の入口のみ合成。**調査対象 ref はデモ隔離ブランチ**（本番は deployed ref）。コミット差分・AI分析・修正PR は実物」。軸は「入口が合成か実外部ソースか」「調査 ref がデモ隔離か本番 ref か」「PR/外部リンクが実 draft か代表値か」で正確に示す。

### シナリオXX：予兆ブリーフィング（stretchⅡ・v15追加）

> **2026-06-29 実コード照合: 未実装**（設計案のみ。`Monitoring/Forecast/` 配下のコードは現状存在しない）。
> 以下は構想記述として残す。着手時は step1 の Forecast ツリーごと新規作成する。

reactive（事後対応）から **proactive（事前予防）** へのシフトレフト。統計MLではなく **既知の未来シグナル × 蓄積記憶 の LLM推論＋引用検証** で根拠付き予報を出す。録画前提（ライブ安定化コスト不要）。

```
前提: シナリオ1〜3でSimilarIncident/KnownErrorPatternが数件蓄積済み
      Terraform にpool縮小PRをステージ済み（未マージ）
      Schedule seed（週末セール=checkout 負荷x5）を設定済み

1. バックオフィスから POST /forecast（horizon="今週末"）
2. ForecastRiskCommandHandler が自律的に収集:
   ├─ GitHubGateway.listOpenPullRequests()    → PR#123「DB pool 100→40」
   ├─ TerraformGateway.getPendingPlan()        → 未適用: connection_pool縮小
   └─ ScheduleSource.list("今週末")            → Sat 20:00-23:00 checkout x5
   ├─ ForecastMemoryRepository.findBySubjects  → 過去「pool縮小+高負荷→枯渇」3件
3. 全シグナルを ForecastSignal[] に正規化 → ForecastContext 構築
4. GeminiForecastAdapter（引用必須プロンプト）→ RiskForecast 生成
5. 引用検証: 各リスクの citations が実在シグナルを参照しているか照合
   → 根拠なし予報は自動除外（ハルシネーション・ガード）
6. バックオフィスに結果表示:
   「土20:00、DB接続枯渇 HIGH（confidence 0.78）
    根拠: [PR#123 pool縮小] × [Sat 20:00 負荷x5] × [過去同型3件]」
   ← CitationList で引用チップを可視化（嘘でない証拠を視覚的に示す）
```

> **差別化軸**: 既存 stretch（ADK）は「どれだけ高度に作ったか」、予兆は「どんな独自価値か」。P1（InfraInvestigation Gateway群）の先行投資が伏線回収される構造。

---

## Monitoringコンテキスト設計方針

> 詳細は `docs/step4-2-monitoring-context.md` を参照。以下は実装時に必ず守る制約のサマリー。

### AlertClassifierの分類アーキテクチャ（Classifier / Policy / Rule の3層）

分類は「IAM 的な階層構造」で表現する。強化は「Classifier 丸ごと差し替え」ではなく「**Policy に Rule を足す**」。

```
AlertClassifier（インターフェース）← AnalyzeAlertCommandHandler はこの抽象にのみ依存
  └─ PolicyBasedAlertClassifier         ← category で担当 Policy にディスパッチ
       └─ ApplicationClassificationPolicy ← ClassificationRuleSorter で Rule を優先度順に並べ first-match
            ├─ KnownPatternRule      ← Step1：ハッカソン本体（kind=EXACT_MATCH・完全一致・confidence 1.0固定）
            ├─ SimilarPatternRule    ← Step2：Elastic hybrid search（kind=SIMILARITY・類似スコアリング）
            └─ AiInferenceRule       ← 将来：AI port 内包（kind=INFERENCE）
```

- **分類対象は `MonitoringEvent`**（Alert ではない）。生成物が `AlertClassification` VO
- **各 Rule が判定に必要な依存（repository / 外部検索 / AI port）を自分で内包する**。これにより InMemory 完全一致・Elastic スコアリング・AI 推論を同一 IF の裏で共存できる（`match(event, patterns[])` を強制する単一アルゴリズム抽象は Elastic/AI に噛み合わないため不採用）
- スコアリングの計算ロジックは各 Rule 実装の内部に閉じる
- `AnalyzeAlertCommandHandler` は `classify(monitoringEvent)` を呼ぶだけ。パターン取得・照合の内部実装を知らない（`KnownErrorPatternRepository` にも依存しない＝`KnownPatternRule` が内包）

### ルール優先度（kind と Sorter の分離）

- **`priority: number` を Rule に持たせない**。優先度は「ルール間の関係」。一方 `kind`（EXACT_MATCH / SIMILARITY / INFERENCE）は「その Rule がどんな証拠を出すか」という属性なので Rule が持つ
- **`ClassificationRuleSorter`（ドメインサービス）** が kind 優先順位で Rule を並べ替える。配列順に依存せず確定的（「暗黙の配列順で優先度が決まる」事故を防ぐ）。具体実装を知らず kind しか見ないため domain に置ける（DIP を侵さない）
- **分類器グラフの組み立て（依存注入）は composition root＝backoffice の DI** の責務。`AlertClassifier` IF も Handler もノータッチで Rule を追加できる

### AlertClassifierの実装段階戦略（v11）

#### Step1：KnownPatternRule（完全一致・ハッカソン本体スコープ）

| 項目         | 内容                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| 実装クラス   | `KnownPatternRule`（kind=EXACT_MATCH・`KnownErrorPatternRepository` を内包）         |
| マッチ戦略   | first-match（先着優先の完全一致）                                                    |
| confidence   | 1.0固定                                                                              |
| インフラ依存 | なし（オンメモリ。Mongo実装は backoffice DI で注入）                                 |
| **完了条件** | デモシナリオ1・2・3がE2Eで通る。**この状態でコミットを切り、提出できる状態をキープ** |

#### Step2：SimilarPatternRule（Elastic類似検索・シナジー完成フェーズ）

| 項目         | 内容                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 実装クラス   | `SimilarPatternRule`（kind=SIMILARITY・Elastic client を内包）                                                                                                                   |
| マッチ戦略   | hybrid search（BM25 + ベクトル検索）による類似スコアリング                                                                                                                       |
| confidence   | Elasticsearchのスコアを正規化して返す                                                                                                                                            |
| クエリ入力   | `InfraEvidence`（アプリログ + Terraform差分 + GitHubコミット）を含む多次元コンテキスト                                                                                           |
| インフラ依存 | Elastic Cloud（公式サイトから直接登録で14日間無料トライアル）                                                                                                                    |
| 追加方法     | `ApplicationClassificationPolicy` の Rule 配列に足すだけ（`ClassificationRuleSorter` が SIMILARITY を EXACT_MATCH の次に自動配置）。`AlertClassifier` IF も Handler もノータッチ |
| **完了条件** | `SimilarPatternRule` を Policy に追加し DI で差し替え可能。InfraEvidenceでクエリが強化されている状態                                                                             |
| 注意         | **Elastic CloudはGCPマーケットプレイス経由で登録すると無料トライアルがない。公式サイトから登録する**                                                                             |

**インフラ証拠とElasticのシナジー（v12追加）**:
インフラ横断調査（フェーズ1）を先に完成させてからElastic（フェーズ2）に入ること。
アプリログのみをクエリにするより、`InfraEvidence`（アプリログ + Terraform差分 + GitHubコミット）を合わせた多次元コンテキストでハイブリッド検索する方が類似障害パターンのマッチ精度が大幅に向上する。

#### Step3：AiInferenceRule（AI推論フォールバック・将来・stretch）

> **注意**: Step3 はあくまで `ApplicationClassificationPolicy` に追加する第3の Rule。`ADKAgentInvestigationAdapter` は `AIInvestigationPort`（調査層）側の進化であり、`AlertClassifier`（分類層）の段階ではない（混在させない）。a2aは使用しない。

| 項目           | 内容                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- |
| 実装クラス     | `AiInferenceRule`（kind=INFERENCE・AI port を内包）                                             |
| マッチ戦略     | EXACT_MATCH / SIMILARITY が棄権した場合のフォールバック推論（confidence を返す）                |
| confidence     | AI の確信度を正規化して返す（0.0〜1.0）                                                         |
| インフラ依存   | AI port（Gemini 等）。Elastic を併用する場合は Step2 ベース                                     |
| **完了条件**   | `AiInferenceRule` を Policy に追加し DI で差し替え可能。`AnalyzeAlertCommandHandler` ノータッチ |
| 着手タイミング | Step2（Elastic）完了後。ハッカソン締切後のポートフォリオ強化フェーズ                            |

#### リスク管理方針

```
フェーズ0完了 → コミットを切って「提出できる状態」を確保
  ↓
フェーズ1：インフラ横断調査（最優先の差別化）
  ↓
フェーズ1.5：DevOpsループ（CI/CD・セキュリティ・PR起票）
  ↓
フェーズ2：Elastic類似検索（シナジー完成）
  ↓
フェーズ3：ADK in-processマルチエージェント（a2a不使用・DI差し替えのみ）
  ↓
〆切7/10 → 到達したフェーズで提出
```

### AIInvestigationPort 設計方針（GCP要件段階移行）

> **2026-06-29 実装状況**: フェーズ0（Gemini直接）とフェーズ2（ADK）は**実装済み**。フェーズ1 `VertexLLMClient` は未実装で、テスト/デモ用に `StubLLMClient`（`AI_INVESTIGATION_STUB=true` で決定的応答）が存在する。

```
AIInvestigationPort（インターフェース）← Application層が依存する抽象
  ├─ LLMInvestigationAdapter            ← オーケストレーション（プロバイダ非依存・全フェーズ共通）
  │     └─ LLMTextClient（DI）          ← text in → text out のプロバイダ抽象
  │           ├─ GeminiLLMClient        ← フェーズ0：ハッカソン本体（Gemini API直接）【実装済み】
  │           ├─ StubLLMClient          ← テスト/デモ用の決定的スタブ（AI_INVESTIGATION_STUB）【実装済み】
  │           └─ VertexLLMClient        ← フェーズ1：Vertex AI SDK経由（推奨経路）【未実装】
  └─ ADKAgentInvestigationAdapter      ← フェーズ2：ADK構成（自前オーケストレーション・Portを直接実装・a2a不使用）【実装済み】
```

### AlertClassification VOの設計原則（OCP適用）

- `KnownAlertClassification` VOは「何が根拠か」の構造を定義する。計算ロジックは持たない
- 重み情報（各条件がスコアにどれだけ寄与したか）はVOに持たせない（スコアリング戦略の内部情報）
- `ClassificationConfidence` のみクラス化（0.0〜1.0の範囲制約 + 将来の `isHighConfidence()` 用）
- `MatchedCondition` / `UnmatchedCondition` は `interface` のまま（制約も振る舞いも薄い構造体）

### フィードバックループの自動昇格

```typescript
const AUTO_PROMOTE_THRESHOLD = 3; // 正解フィードバック3回で自動昇格
// 環境変数 FEEDBACK_AUTO_PROMOTE_THRESHOLD でオーバーライド可能（デモ調整用）
```

**位置づけ（学習は2段で進む）**: 学習の本体は **① 連続的な確度付き分類**（正解フィードバック → `SimilarIncident` 蓄積 → 将来 `SimilarPatternRule`(kind=SIMILARITY) が graded confidence で分類）。**昇格（KnownErrorPattern 生成）は ② 離散的な結晶化**で、頻出が確定したものを完全一致・confidence 1.0 の**高速パスに焼き付ける最適化**（速度・決定性。シナリオ3「次回1秒」の効果）。昇格＝学習そのものではなく、①で太った知識のキャッシュ化、と捉えるのが正確。手動昇格（`POST /patterns/:id/promote`）はその即時オーバーライド。

**今の簡略化と将来**: 現状は分類が exact-match のみ＝**0/1 で粗い**。graded confidence の本体（`SimilarPatternRule`）は未実装で `SimilarIncident` はまだ AI 調査の文脈強化にしか使っていない → これを分類に引き込むのが `step4-2` タスク17。昇格ゲートの固定 N（全 Alert を証拠ゼロ扱いする粗い判定。`isFallback` 除外＋eventName 限定マッチで安全側）を、類似確度を取り込んだ加重に上げるのが タスク24/25。背景の差別化文脈は `step4-1` 2章「学習ループ」を参照。

### MonitoringEventの設計原則

- 単一の `MonitoringEvent` 型にすべての検知ソース（EC イベント / Cloud Monitoring / CI）をマッピングする
- ECコンテキストの型をMonitoringコンテキストに直接importしない。源固有の型に触れるのは ingest 境界（subscriber / ingest controller）だけ
- `payload: Record<string, unknown>` として均質に扱い、将来のイベント追加でMonitoringドメインモデルが変わらない構造にする
- **`dedupKey()`（`source::category::eventName`）で重複観測を畳む**。同一 dedupKey の未解決 Alert があれば `AnalyzeAlert` は新規作成・再分類・再調査せず `occurrenceCount` を加算（UI は「×N」・アラート嵐の抑制）。aggregateId は含めない＝同型障害の連発を1件に集約。closed/回復通知は `severity=info`＝`isAlertable()=false` で観測のみ

---

## エラー設計方針

### ハッカソンスコープ：3基底クラス

```
DomainError          → errorHandler → 400
ApplicationError     → errorHandler → 400 or 404（サブクラスで判別）
InfrastructureError  → errorHandler → 500
```

---

## MongoDBに統一する設計判断の根拠

- MonitoringイベントとAI分析結果はスキーマが可変 → MongoDBが自然
- ECドメインは本来PostgreSQLが適切（ACID整合性）。ハッカソンスコープで統一し、整合性はアプリケーション層で担保する
- `OrderRepository` / `InventoryRepository` インターフェースをDomain層に置き、MongoDB実装とPostgreSQL実装を差し替え可能にする
- MongoDB依存の型・クエリをInfrastructure層に完全に閉じ込め、Domain層に漏らさない

### 在庫引き当て戦略ロードマップ

| フェーズ   | 実装                                          | 前提条件・移行トリガー                                    |
| ---------- | --------------------------------------------- | --------------------------------------------------------- |
| ハッカソン | 事前チェック＋楽観ロック＋補償（MongoDB単体） | ReplicaSetなし、低競合                                    |
| 中期       | MongoDBマルチドキュメントトランザクション     | ReplicaSet構成に移行                                      |
| 長期       | PostgreSQL＋悲観ロック（`SELECT FOR UPDATE`） | 高競合・フラッシュセール等。ADR Step5のトリガー条件と連動 |

#### 現行実装のトレードオフ整理（ハッカソンフェーズの設計判断根拠）

**単一アイテムのレースコンディション**は解決済み。
`validateStock`（事前チェック）と`reserveAll`（楽観ロックCAS）の間にウィンドウはあるが、
`attemptReserveWithRetry`内でCONCURRENT_CONFLICT時に再fetchして再試行するため実質カバーされている。

**本質的な問題は複数アイテム間の部分成功**。注文は複数商品を扱うため、
アイテムA・B成功→アイテムC失敗のときA・BのデクリメントだけDB反映される瞬間が存在する。
現行実装では`InventoryReservationFailedDomainEvent`の`reservedProductIds`フィールドを使って
補償トランザクション（ダウンストリームのイベントハンドラがロールバック）で最終的整合を担保している。

**完全なアトミック性を得るための選択肢とトレードオフ**:

| アプローチ                                | 効果                                    | コスト                                                          |
| ----------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| DB atomic check-and-reserve（1クエリ）    | 単一アイテムのvalidate+reserveを1往復化 | 複数アイテム間の部分成功は解消しない                            |
| MongoDBマルチドキュメントトランザクション | 全アイテムの真のACID原子性              | ReplicaSet必須。ホット商品でロック競合→スループット低下のリスク |
| Soft Reserve（在庫ホールド）パターン      | 部分成功が外部に漏れない                | pending状態のステートマシン・期限切れ処理が必要。実装コスト大   |

ハッカソンスコープでは「補償トランザクション」を採用。
EC系本番の標準パターンであり、MongoDBのReplicaSet未構成・低競合の前提条件に適合している。

---

## バックオフィス画面構成

| パス          | 役割                                                                 | デモドロワー                     |
| ------------- | -------------------------------------------------------------------- | -------------------------------- |
| `/alerts`     | アラート一覧 ＋ カード展開（AI分析結果・証拠パネルをインライン表示） | **常時表示**（デモのメイン舞台） |
| `/alerts/:id` | フル詳細ページ（証拠一覧・調査プロセス全表示）                       | **非表示**                       |
| `/analytics`  | AI精度トラッキング                                                   | 非表示                           |

---

## バックオフィスAPIエンドポイント

```
GET  /alerts
GET  /alerts/:id
PATCH /alerts/:id/feedback
GET  /alerts/stream                    ← SSE
GET  /patterns
POST /patterns/:id/promote
GET  /analytics
POST /demo/payment-mode
POST /demo/scenario/:id/trigger
POST /demo/reset
POST /demo/reset/alerts
POST /demo/reset/patterns
POST /demo/reset/analytics
GET  /demo/status

# インフラ調査関連（v12追加）
GET  /alerts/:id/evidence              ← 収集済みInfraEvidenceの取得
GET  /alerts/:id/investigation/status  ← 調査ステータス（collecting / analyzing / done）

# 検知ソース ingest（v19追加・検知境界）
POST /ingest/cloud-monitoring          ← Cloud Monitoring Alerting Policy発火の受信（MonitoringEvent(INFRASTRUCTURE/CAPACITY)化）。x-ingest-token で認証（INGEST_TOKEN 設定時）

# CI/CD連携・自律リメディエーション（v13追加）
POST /ingest/security-scan             ← CIからの脆弱性スキャン結果受信（MonitoringEvent(SECURITY)化）
POST /alerts/:id/remediation/draft-pr  ← 承認操作：RemediationPlanからPR草案を起票（write・人間承認ゲート）
GET  /alerts/:id/remediation           ← 起票済みPRのURL・ステータス取得

# 予兆ブリーフィング（v15追加・stretchⅡ）
POST /forecast                         ← 予兆生成トリガー（horizon指定）→ ForecastRiskCommandHandler
GET  /forecast                         ← 最新 RiskForecast 取得（引用付きリスク一覧）
```

---

## スコープ外（ハッカソンでは実装しない）

- ユーザー認証（userIdは固定値でOK）
- 商品マスタ管理UI（データ直入れ）
- 返品・キャンセルフロー
- **ECフロントエンドUI**（Swagger UIで代替）
- 決済処理（PaymentMockGatewayで代替）
- Cloud Monitoring / Cloud Trace ゲートウェイの実装（設計・ADRのみ。次フェーズ）
- `terraform apply` 等の書き込み操作

---

## 構造化ログ設計

```typescript
interface StructuredLog {
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  service: string;
  user_id?: string;
  action?: string;
  message: string;
  timestamp: string;
  error_code?: string;
  retry_count?: number;
  stack_trace?: string;
}
// trace_id / span_id は OTel SDK がアクティブスパンから自動付与する。
// StructuredLog には含めない。SDK未初期化時（テスト等）はそのフィールドごと省略される。
```

---

## 設計上の制約・注意事項

### 必ず守ること

- `Shared/domain/` にはインフラ依存のコードを置かない
- DomainEventは必ず `fromPrimitives()` / `toPrimitives()` を持つ
- RepositoryのインターフェースはDomainに置き、実装はInfrastructureに置く
- ECドメインはMonitoringを直接importしない
- MonitoringドメインはECコンテキストの型を直接importしない（`MonitoringEvent` で変換して受け取る）
- **検知ソース（EC イベント / Cloud Monitoring / CI）は peer な ingest アダプタで合流する。源固有の型に触れるのは ingest 境界だけ。検知（dedup/相関/閾値発火）は上流の責務＝境界の外**（v19）
- **重複観測は `MonitoringEvent.dedupKey()` で畳む。同一 dedupKey の未解決 Alert は再分類・再調査せず `occurrenceCount` 加算。被りの主防御は category オーナーシップ、異症状・同一根本原因の相関は AI 調査に委譲しエンジン化しない**（v19）
- `DemoDrawer.tsx` は `/alerts` のレイアウト層にのみ差し込む
- ApplicationService / CommandHandler は `Logger` interfaceにのみ依存し、GCP固有実装を直接importしない
- ApplicationServiceのメソッド名は `run()` で統一する（CodelyTV準拠）
- Domain・Application層はHTTPステータスコードを知らない。errorHandlerがHTTPへの変換責務を持つ
- 外部サービスへのアウトバウンドポートは `XxxGateway` と命名する
- ドメインサービスを作る場合は `XxxDomainService` と明示的にサフィックスをつける
- 実装の再利用を目的に継承（基底クラス）を使わない。共通処理は**コンポジション（has-a・コンストラクタ注入）を優先**する。`is-a` が成立しない継承はSRP/OCPを崩す。詳細は「コンポジション優先（has-a / 継承よりコンポジション）」節
- `AlertClassifier` はインターフェースにのみ依存する。具体実装（`PolicyBasedAlertClassifier` 等）を直接importしない
- 分類は Classifier / Policy / Rule の3層。Rule は依存を内包し `kind`（EXACT_MATCH/SIMILARITY/INFERENCE）を持つ。優先度は `ClassificationRuleSorter`（domain）が kind 順で確定し、Rule に `priority` 数値を持たせない
- 分類器グラフの組み立て（依存注入）は composition root（backoffice DI）の責務。Sorter は組み立てない
- `ClassificationConfidence` のみVOとしてクラス化する
- **`AIInvestigationPort` はポートインターフェース名にプロダクト名を含めない**（v10）
- **`SimilarPatternRule`（Elastic を内包する分類 Rule）はElastic Cloud公式サイトから直接登録したインスタンスに接続する**（v11/v16改訂）
- **Step3（`AiInferenceRule`）はStep2（`SimilarPatternRule`・Elastic）完了後に着手する。a2aは使わない**（v11/v14/v16改訂）
- **`TerraformGateway` / `GitHubGateway` / `CloudLoggingGateway` はすべて読み取り専用。書き込み操作のメソッドを定義しない**（v12）
- **`InfraEvidence` はInfrastructure層の生レスポンスをドメイン型に正規化してから渡す。各Gatewayの生レスポンス型をMonitoringドメインに持ち込まない**（v12）

### ハッカソンスコープで許容する妥協

- 決済は `PaymentMockGateway` で代替（`success` / `random` / `timeout` の3モード）
- フロントエンドはSwagger UIで代替（ECフロント）
- 在庫の同時更新競合は2フェーズ（事前チェック＋楽観ロック＋補償）で対応
- userId認証なし（固定UUIDで代替）
- エラー基底は3クラスのみ。細粒度化は将来の拡張
- AlertClassifierはfirst-matchのみ実装。スコアリングはインターフェースのコメントに将来実装として明記
- SSEAlertNotifierはEventEmitterオンメモリ
- **AIはGemini API直接（フェーズ0）のみ実装。Vertex AI / ADKへの移行はAIInvestigationPortの差し替えで対応できる設計にし、実装はハッカソン後のフェーズに委ねる**（v10）
- **AlertClassifierはStep1（`KnownPatternRule`・完全一致）のみハッカソン提出必須。Step2（`SimilarPatternRule`・Elastic）・Step3（`AiInferenceRule`）は工数が許す範囲で Policy に Rule を足す形で積み上げる。a2aは使わない**（v11/v14/v16改訂）
- **Cloud Monitoring / Cloud Trace ゲートウェイは設計・ADRのみ。実装は次フェーズ**（v12）

### コンポジション優先（has-a / 継承よりコンポジション）（v17追加）

「共通処理を親クラスに寄せて継承させる」前に、**has-a（部品としてDI）で構成できないか**を必ず先に検討する。`extends` は「である（is-a）」、コンポジションは「持つ／使う（has-a）」を表す。**実装の再利用目的だけで継承を使わない**（実装継承は is-a を偽装し SRP/OCP を崩す）。

判断基準:

- サブクラスが親の「一種」と言えない（is-a が成立しない）なら継承しない
- 振る舞いを差し替え／テストで注入したいなら、インターフェース＋コンストラクタ注入（Poor Man's DI）にする
- 「ちょっとだけ親を上書き」したくなったら継承の誤用のサイン

**具体例（AIInvestigation）**: 単一 `GeminiAIInvestigationAdapter` がプロンプト整形・パース・マッピング・fallback・リトライ・SDK呼び出しを全部抱え SRP違反だった。これを **プロバイダ非依存のオーケストレーション** と **プロバイダ固有の text-in/text-out** に分離。基底クラス（Template Method）でなくコンポジションを採用した。

Before（継承・避ける）:

```typescript
abstract class AbstractAIInvestigationAdapter implements AIInvestigationPort {
  async investigate(ctx: InvestigationContext): Promise<InvestigationReport> {
    const prompt = this.buildPrompt(ctx);
    const raw = await this.generate(prompt); // ← 子に丸投げ
    const out = this.safeParse(raw);
    return out ? this.toReport(out) : this.fallback();
  }
  protected abstract generate(prompt: string): Promise<string>;
}
class GeminiAIInvestigationAdapter extends AbstractAIInvestigationAdapter {
  protected generate(p: string) {
    /* Gemini SDK */
  }
}
// 問題: Geminiアダプタは「調査オーケストレーションの一種」ではない（is-a不成立）。
//       オーケストレーションのテストに毎回サブクラスが要る。子が親処理を上書きでき境界が緩い。
```

After（コンポジション・採用）:

```typescript
// domain: プロバイダ抽象（text in → text out のみ）
interface LLMTextClient {
  generate(systemInstruction: string, prompt: string): Promise<string>;
}

// オーケストレーション本体。LLMTextClient を「部品として注入」される（has-a）
class LLMInvestigationAdapter implements AIInvestigationPort {
  constructor(private readonly llm: LLMTextClient) {}
  async investigate(ctx: InvestigationContext): Promise<InvestigationReport> {
    const prompt = buildUserPrompt(ctx);
    let raw: string;
    try {
      raw = await this.llm.generate(SYSTEM_INSTRUCTION, prompt);
    } catch {
      return buildFallback();
    } // API/timeout失敗 → fallback
    const out = safeParse(raw);
    return out ? toReport(out) : buildFallback(); // パース不能 → fallback
  }
}

// infrastructure: プロバイダ固有実装 + 呼び出しの信頼性（リトライ/タイムアウト）
class GeminiLLMClient implements LLMTextClient {
  async generate(systemInstruction: string, prompt: string) {
    /* Gemini SDK + 30sタイムアウト1回リトライ */
  }
}

// composition root（backoffice DI）で組み立てる
const port: AIInvestigationPort = new LLMInvestigationAdapter(
  new GeminiLLMClient(),
);
```

効果:

- is-a の意味ズレを回避（アダプタは LLMClient を「使う」だけ）
- フェイクの `LLMTextClient` を注入してオーケストレーションを単体テストできる（Gemini不要）
- プロバイダ追加は `LLMTextClient` 実装を1つ足すだけ。契約が狭く境界が固い
- リトライ／タイムアウトは**プロバイダ固有実装（インフラの関心事）側に寄せる**

> 配置: `LLMInvestigationAdapter` は driven ポート `AIInvestigationPort` の実装＝腐敗防止層（プロンプト整形・LLM出力パース・マッピングという技術知識を持つ）なので **infrastructure** に置く。「プロバイダ非依存」＝「domain」ではない。ドメインに置くのは抽象（`AIInvestigationPort` / `LLMTextClient`）のみ。
> 例外: ADK マルチエージェント（フェーズ2）は単純な text-in/text-out に収まらず自前オーケストレーションを持つため、`LLMInvestigationAdapter`/`LLMTextClient` を経由せず `AIInvestigationPort` を直接実装する。

---

## 出力してほしいアウトプット

| Step       | 詳細設計ドキュメント                                                                                                | ステータス      |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | --------------- |
| **Step 1** | `docs/step1-directory-structure.md`                                                                                 | ✅ **確定済み** |
| **Step 2** | `docs/step2-domain-model.md`                                                                                        | ✅ **確定済み** |
| **Step 3** | `docs/step3-application-layer.md`                                                                                   | ✅ **確定済み** |
| **Step 4** | `docs/step4-{1-strategy,2-monitoring-context,3-backoffice-backend,4-backoffice-frontend}.md`（各 `*-todo.md` 付き） | ✅ **確定済み** |
| **Step 5** | ADR                                                                                                                 | 🔲 次のステップ |

### Step 5で作成するADR

1. MongoDBをECドメインに使用する理由
1. ECとMonitoringをRabbitMQで疎結合にする理由
1. Gemini APIへのコンテキストをトークン上限3,500に絞る理由
1. 観測基盤にGCPネイティブを採用する理由と移行判断基準
1. 類似障害検索をインメモリ + CriteriaConverterパターンで実装する理由
1. デモコントロールドロワーを `/alerts` レイアウト層にのみ差し込む理由
1. 構造化ログをOTel一括化しWinstonを使わない理由
1. サンプリングをハッカソンスコープで実装しない理由と将来方針
1. AlertClassifierを Classifier/Policy/Rule の3層で設計しハッカソンでは `KnownPatternRule`（first-match）のみ実装する理由
1. AlertClassification VOに重み情報を持たせず各 Rule 実装に閉じる理由
1. **分類の優先度を Rule の `priority` 数値でなく `kind`（属性）＋ `ClassificationRuleSorter`（関係・domain）で表現する理由。組み立て（依存注入）を composition root に分離する理由**（v16追加）
1. AIInvestigationPortをプロダクト名に依存しない抽象名にする理由と段階移行設計（v10）
1. ハッカソン本体でGemini API直接を選択しVertex AI / ADK移行を後続フェーズとする理由（v10）
1. **AlertClassifierを Classifier/Policy/Rule の3層にし、`KnownPatternRule` → `SimilarPatternRule`（Elastic）→ `AiInferenceRule` の3ステップで Policy に Rule を足して段階強化する理由と各ステップの完了条件（priority数値でなく kind+Sorter で優先度を持つ理由・a2aは使わない理由を含む）**（v11/v14/v16改訂）
1. **インフラ横断調査をAlertClassifier（Elastic類似検索）と別レイヤーに分離し、証拠収集→事例照合→AI推定のパイプラインとして設計する理由**（v12追加）
1. **TerraformGateway・GitHubGateway・CloudLoggingGatewayを読み取り専用に限定する理由**（v12追加）
1. **Cloud Monitoring・Cloud Traceのゲートウェイ実装を次フェーズとしてADRに明記する理由と移行トリガー**（v12追加）
1. **パッケージマネージャーをnpmからpnpmに移行した理由**（v13追加）
1. **Turborepoを導入しDockerビルドでturbo pruneを使用する理由**（v13追加）
1. **コンテナ環境をlocal/prodの2環境のみに絞った理由とdocker-compose分割方針**（v13追加）
1. **アプリをコンテナ化してローカルE2Eを可能にした理由（インフラのみコンテナ vs アプリも含む）**（v13追加）
1. **マルチエージェントをa2aでなくADK in-processで構成する理由（a2aは異ベンダー相互運用専用であり本構成には不要）**（v13追加）
1. **`MonitoringEvent.category` を弁別子フィールドにし、調査担当ルーティングのキーとする理由（a2a非依存の前方互換）**（v13追加）
1. **調査(read)とリメディエーション(write)を分離し、PR起票のみを `RemediationPort` に隔離し自動マージしない理由**（v13追加）
1. **CIで検出した脆弱性を `MonitoringEvent(SECURITY)` 化して同一調査パイプラインに流す理由（DevOpsループの実証）**（v13追加）
1. **「とどける」の見せ場を Compute Engine 単機でなく Cloud Run（一部）に載せる判断と、EDA（RabbitMQ常駐Subscriber）とCloud Runステートレス性のトレードオフ**（v13追加）
1. **予測を統計MLでなくLLM推論＋引用検証で構成する理由（データ依存を切る判断・デモ規模での成立）**（v15追加）
1. **joinを自前ルールエンジンでなくLLMに委譲し、人間は正規化／引用縛り／引用検証の3点足場に限定する理由**（v15追加）
1. **突合キーを(A)テキストjoin→(B)構造化タグへ段階移行する理由（精度と既存P0無傷のトレードオフ）**（v15追加）
1. **予兆ブリーフィングをP0パイプライン無傷の追加レイヤー（read-onlyの調査の一種）として載せる設計判断**（v15追加）
1. **なぜCloud Pub/Subでなく、Rabbit MQか？**-> ローカル開発(E2Eテスト)の開発サイクル短縮が狙い
1. **AIInvestigationの調査ロジックを基底クラス継承でなくコンポジション（`LLMInvestigationAdapter` + `LLMTextClient`）で分離する理由（has-a/is-a・SRP・テスト容易性・リトライをプロバイダ実装に寄せる判断・Port実装をinfrastructureに置く根拠）**（v17追加）
1. **学習を 0/1 の昇格でなく「①連続的な確度付き分類（SimilarIncident 蓄積 → SimilarPatternRule・graded confidence）＋②頻出知識を完全一致の高速パスに焼き付ける結晶化（昇格）」の2段で構成する理由。昇格は学習そのものでなく結晶化の最適化であり、結晶化ゲートを固定回数 → 類似確度加重へ上げる判断（LLM の生 confidence は較正前提で主役にしない・「人間 > 類似の積み上げ > AI自己申告」の重み付け）**（v18追加）
1. **予兆の入力源を `ForecastSignalSource` で源非依存に抽象化し、stretchⅢで event-log 源を追加してもハンドラ・ポートをノータッチにする理由（stretchⅡ→Ⅲを再設計でなく追加で繋ぐ継ぎ目）**（v18追加）
1. **ログベース・イベントソーシング基盤（全DomainEvent追記＋予知ビュー）を前倒しせず stretchⅢ に置く理由（薄い／障害寄りの現行DomainEventでは予兆の母集団が不足しデモ価値が出ない・DDIA unbundling は設計とADRで先に示す）**（v18追加）
1. **予知の差別化を「予知機構」でなく「入力データの質（DDDの集約粒度の業務 DomainEvent）」に置く理由。OpenTelemetry 標準のインフラ指標は横展開でき汎用ベンダーが作れるが、ドメインイベントは会社ごとに異なり外部ベンダーが原理的に作れない内製の強み（ビジネスオブザーバビリティ）であること**（v18追加）
1. 「正常系の業務イベントなのにアラートを出す」のは壊れていたので、観測の収集とアラート判定を分離するトリアージゲートを入れました（決定どおり severity 軸・CollectMonitoringEventUseCase 配置）。今は severity=info を「正常系」のプロキシにしています。将来 info でも「監視したい正常系」と「本当に捨てる正常系」を分けたくなったら、category とは別軸の明示弁別子（BUSINESS/FAULT）への昇格を検討する余地があります。今は不要と判断してやっていません。

---

## 変更履歴

### v19.1（2026-06-29 実コード照合・ドキュメント最新化）

実コード > step4系 > step1〜3/project-prompt を正の基準に、後追いの旧記述を実体へ寄せた。

- シナリオ5: デモ卓 合成シナリオ（`SecurityScanTranslator`→`CollectMonitoringEventUseCase`・即時/確実）と、本物CI証明（`ci.yml` は PR 非発火・main merge 限定 + secrets/デプロイ前提）の**役割分離**を明記。レポート実リンクは出せない割り切りも明文化。
- AIInvestigationPort: ADK（フェーズ2）は実装済み、`VertexLLMClient`（フェーズ1）は未実装で `StubLLMClient` が代替、と実装状況を注記。
- シナリオXX（予兆/Forecast）: 未実装（設計案のみ）であることを明示。
- 連動して step1（`Monitoring/Remediation` の AIInvestigation 内包・`Forecast` 未実装・ADK 実装済み）、step2（Payment コンテキスト・`InventoryFailureReason` VO化・補償フロー追記）、step3（`CollectMonitoringEventOnECEventPublished` への改名/再配置・実キュー名）を修正。

### v18（予兆を stretchⅡ＝現行 / stretchⅢ＝イベントソーシング予知ビュー に再構成）

- 予兆ブリーフィングの入力は2系統（記憶＝過去インシデント/Mongo ＋ 未来シグナル＝PR/plan/schedule のライブread）で**どちらも event log ではない**ことを明記。イベントソーシングは Mongo の移行でなく新基盤の追加
- 予兆の入力源を `ForecastSignalSource` IF で源非依存に抽象化（`ForecastRiskCommandHandler` は `ForecastSignalSource[]` を回す）。stretchⅢ は `EventLogPrecursorSource` を1個足すだけ＝Ⅱ→Ⅲが再設計でなく追加に
- stretchⅢ（ログベース・イベントソーシング基盤＋予知ビュー）を新設。EC ドメインイベント拡張・EventLog 追記 sink・ForecastMemory 上流差し替え・EventLogPrecursorSource を設計（実装はハッカソン後、ADR で先に示す）
- 差別化の性質を「予知機構」→「入力データの質（業務 DomainEvent の粒度）」に転換。DDIA unbundling（event log ＋ 調査ビュー/予知ビューの2ビュー）を骨格として明記
- コンテキスト構成に `EventLog/`（stretchⅢ・設計のみ）を追加
- Step 5 ADR 項目に3件追加（ForecastSignalSource 継ぎ目 / イベントソーシングを前倒ししない / 入力データの質が moat）
- 詳細は `step4-1` §7.9・§7.10、`step4-2` 予兆節、各 todo の stretchⅡ/Ⅲ

### v17（コンポジション優先の設計指針を明文化）

- 「必ず守ること」に「実装再利用目的の継承を避けコンポジション（has-a・コンストラクタ注入）を優先」を追加
- 「コンポジション優先（has-a / 継承よりコンポジション）」節を新設。Before（継承・Template Method）/ After（コンポジション）の具体コード付き
- 実例として AIInvestigation の SRP違反な単一 `GeminiAIInvestigationAdapter` を `LLMInvestigationAdapter`（オーケストレーション）＋ `LLMTextClient` / `GeminiLLMClient`（プロバイダ固有・リトライ内包）に分離した経緯を記載
- 設計判断: 当該アダプタは driven ポート実装＝腐敗防止層なので **infrastructure** に置く（「プロバイダ非依存」≠「domain」）。ドメインに置くのは抽象（Port / LLMTextClient）のみ
- Step 5 ADR項目に1件追加（コンポジション分離の理由）
- ヘッダーバージョンを v16 → v17 に更新
- 詳細は `step1`・`step4-2`「AIInvestigationPort」「LLMTextClient」「LLMInvestigationAdapter ＋ GeminiLLMClient」節

### v16（AlertClassifier を Classifier/Policy/Rule 3層に再設計）

- `AlertClassifier`（IF）→ `PolicyBasedAlertClassifier` → `ClassificationPolicy`（category単位）→ `ClassificationRule`（最小単位・依存を内包）の3層に再設計
- 単一アルゴリズム抽象（`match(event, patterns[])`）を廃止。各 Rule が repository / 外部検索 / AI port を内包することで Elastic・AI も同一 IF に収まる
- 段階強化を「Classifier 丸ごと差し替え」から「Policy に Rule を足す」へ：`KnownPatternRule`（EXACT_MATCH）→ `SimilarPatternRule`（SIMILARITY・Elastic）→ `AiInferenceRule`（INFERENCE）
- ルール優先度を Rule の `priority` 数値でなく `kind`（属性）＋ `ClassificationRuleSorter`（関係・domain・配列順非依存）で表現
- 分類対象が `MonitoringEvent`（Alertではない）であることを明記。`classify(monitoringEvent)` に署名変更し、`AnalyzeAlertCommandHandler` から `KnownErrorPatternRepository` 依存を除去（`KnownPatternRule` が内包）
- 分類器グラフの組み立て（依存注入）は composition root（backoffice DI・step4-3）の責務に分離
- Step 5 ADR項目に1件追加（kind+Sorter で優先度を表現する理由）
- ヘッダーバージョンを v15 → v16 に更新
- 詳細は `step4-2`「分類アーキテクチャ（Classifier / Policy / Rule の3層）」「ルール優先度の決定箇所」節

### v15（予兆ブリーフィング stretchⅡ追加）

- デモシナリオ6（予兆ブリーフィング）を追加。reactive（事後）→ proactive（事前）のシフトレフト
- コンテキスト構成に `Forecast/`（stretchⅡ）を追加
- APIエンドポイントに `POST /forecast` / `GET /forecast` を追加
- 実装TODOにフェーズ4（Step5-Forecast-a〜g + Step5-Demo）を追加
- Step 5 ADR項目に4件追加（LLM推論+引用検証・join委譲・突合キー段階移行・P0無傷の追加レイヤー）
- ヘッダーバージョンを v14 → v15 に更新
- 詳細は `step4-1` §7・`step4-2`「予兆ブリーフィング」節・`step4-3/4`「stretchⅡ」節・各 todo `stretchⅡ` セクション

### v14（a2a廃止に伴う Monitoringコンテキスト設計方針の整合修正）

- AlertClassifier Step3テーブルを「A2A統合（ADKAgentInvestigationAdapter）」から「ScoringAlertClassifier」に全面差し替え
  - `ADKAgentInvestigationAdapter` は `AIInvestigationPort` 側の実装であり `AlertClassifier` の段階に混在していたのは誤り
  - A2A連携方式・Bootcamp着手タイミングをすべて削除
- AIInvestigationPort図のフェーズ2ラベルを「A2A統合」→「in-process・a2a不使用」に修正
- リスク管理方針から `6/23 Bootcamp受講（A2Aのパターン）` 行を削除し、フェーズ1.5（DevOpsループ）を明記
- 「必ず守ること」「許容する妥協」「ADR項目13」の `Step3（A2A）` 表記を `Step3（ScoringAlertClassifier）` に統一
- 技術スタック表の `Elastic Agent Builder + A2AはP2` を `a2aは不使用（ADK in-processで代替）` に修正
- ヘッダーバージョンを v12（古いまま放置）→ v14 に更新

### v13.1（マルチエージェント・DevOpsループ・カテゴリ弁別子）

- a2aを使わない方針を確定。マルチエージェントはADK in-processで構成（Coordinator + EvidenceCollector / RootCauseAnalyst / RemediationPlanner）
- `MonitoringEvent.category`（APPLICATION/INFRASTRUCTURE/CAPACITY/SECURITY）を弁別子として追加。調査担当ルーティングのキー
- CI/CD連携のセキュリティインシデント（Trivy/npm audit → `MonitoringEvent(SECURITY)` → 調査 → PR起票）を追加し、デモシナリオ5として明文化
- 調査(read)とリメディエーション(write)を分離。PR起票のみ `RemediationPort`（人間承認ゲート・自動マージなし）に隔離
- コンテキスト構成に `Remediation/` と `infrastructure/adk/` を追加
- 「とどける」の見せ場を Cloud Run（一部）に載せる方針とEDAとのトレードオフをADR項目化
- バックオフィスAPIに `/ingest/security-scan` / `/alerts/:id/remediation/*` を追加
- Step 5 ADR項目に6件追加
- 詳細は `docs/step4-2-monitoring-context.md`（ADKマルチエージェント／セキュリティ＋リメディエーション節）を参照
- Step4 を4スコープに分割（戦略/Monitoring/backoffice-backend/backoffice-frontend）し各 `*-todo.md` を新設。フロントは feature-sliced（校正版）に方針確定

### v13（インフラ・ビルドツール整備）

- パッケージマネージャーをnpmからpnpmに移行（`--filter`でコンテナへの不要な依存混入を防止）
- Turborepoを導入。`turbo prune`でDockerビルド時のbackoffice資材混入を排除
- `docker-compose.yml`（ベース）+ `docker-compose.local.yml` / `docker-compose.prod.yml`の分割構成を確立
- `src/apps/ec/backend/Dockerfile`をmulti-stage（pruner/deps/dev/prod）で整備
- `Makefile`に`ENV=local/prod`変数でターゲットを共通化
- 環境変数を`EcBackendApp.ts`から`config.ts`に集約
- Step 5 ADR項目に4件追加

### v12（インフラ横断調査パイプライン追加）

- インフラ横断調査パイプラインを設計に追加（証拠収集→事例照合→AI推定の3レイヤー構造）
- AlertClassifier（Elastic類似検索）とインフラ横断調査はトレードオフではなくシナジー関係であることを明文化
- InfraInvestigationPort / CloudLoggingGateway / TerraformGateway / GitHubGateway のインターフェース設計を追記
- InfraEvidence 型の設計方針を追記（Infrastructure生レスポンスをドメイン型に正規化する原則）
- 実装TODOの優先順位フローを追記（フェーズ0〜3の実装順序と依存関係を明記）
- デモシナリオ4（インフラ変更起因の障害）を追加
- バックオフィスAPIエンドポイントにインフラ調査関連を追加（`/evidence` / `/investigation/status`）
- 技術スタック表にインフラ調査ソース（Cloud Logging API・Terraform CLI・GitHub REST API）を追加
- コンテキスト構成に `AIInvestigation/InfraInvestigation/` を追加
- 「必ず守ること」にGateway読み取り専用・InfraEvidence正規化ルールを追記
- 「ハッカソンスコープで許容する妥協」にCloud Monitoring/Trace次フェーズ方針を追記
- Step 5 ADR項目に3件追加
- スコープ外にterraform apply等の書き込み操作を明記

### v11（AlertClassifier段階戦略・Elastic費用試算追記）

- AlertClassifierの実装を3ステップに段階化
- 各ステップの完了条件・依存関係・着手タイミングを明記
- Elastic Cloud費用試算を追記
- リスク管理方針を明記

### v10（GCP要件充足戦略・AIInvestigationPort段階移行設計追記）

- ハッカソンGCP要件の充足状況を整理し、3フェーズ移行戦略を確定
- AIInvestigationPort のポート名設計方針を追記
- Step 5 ADR項目に2件追加

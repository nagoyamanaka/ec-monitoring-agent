# 設計エージェント向けプロンプト v16

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
> `InvestigateAlertCommandHandler`（Application層）は完全にノータッチ。

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
│   ├── AIInvestigation/
│   │   ├── InfraInvestigation/        ← インフラ横断調査（v12追加・read-only Gateway）
│   │   ├── Remediation/               ← 自律リメディエーション（v13追加・PR起票のwrite隔離）
│   │   └── infrastructure/adk/        ← ADKマルチエージェント（Coordinator + 専門agent。a2a不使用）
│   ├── Forecast/                      ← 予兆ブリーフィング（v15追加・stretchⅡ・reactive→proactive）
│   └── ReportGeneration/
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
  └─ CollectMonitoringEventOnECDomainEvent → AlertAnalysis → AI分析 → SSE push
```

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
【レイヤー3：AI推定】AIInvestigationPort（GeminiAIInvestigationAdapter）
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
  Step1-Gemini:   GeminiAIInvestigationAdapter（Gemini API直接）実装
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
  Step4-Vertex:   VertexAIInvestigationAdapter 実装（DI差し替えのみ）
  Step4-ADK-a:    ADKAgentInvestigationAdapter（Coordinator起動）実装
  Step4-ADK-b:    EvidenceCollector / RootCauseAnalyst / RemediationPlanner サブエージェント実装
  Step4-ADK-c:    自律的な証拠追加収集ループ（analystが収集対象を判断）を実装
                  ← a2aは使わない。1プロセス内のADKサブエージェント構成
  → AIInvestigationPort のDI差し替えのみ。InvestigateAlertCommandHandler ノータッチ

【フェーズ4：予兆ブリーフィング（stretchⅡ・reactive → proactive）】
  ← フェーズ0〜3 ＋ シナリオ5 ＋ GCP実機が全部着地してからのcapstone
  Step5-Forecast-a: ForecastSignal / RiskForecast / Schedule ドメイン型追加（新規・既存無傷）
  Step5-Forecast-b: ForecastMemory projection（突合キーB）+ InvestigationReport に optional subject 追記
  Step5-Forecast-c: Gateway 未来シグナルメソッド追加（listOpenPullRequests / getPendingPlan・read-only維持）
  Step5-Forecast-d: ForecastPort + GeminiForecastAdapter（citations必須強制・引用検証）
  Step5-Forecast-e: ForecastRiskCommandHandler（シグナル収集→正規化→LLM→引用検証・write無し）
  Step5-Forecast-f: POST /forecast・GET /forecast ＋ DI追記・ScheduleSource seed
  Step5-Forecast-g: ForecastPage + RiskCard + CitationList（引用チップ＝体験の肝）
  Step5-Demo:       デモシナリオ6（seed→予兆生成→引用付きリスク）を録画
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

> このシナリオで「つくる（調査エージェント）・まわす（GitHub Actions/CI）・とどける（デプロイ）」の3コンセプトを1ループで踏む。PR起票は唯一のwrite操作で `RemediationPort` に隔離する。

### シナリオ6：予兆ブリーフィング（stretchⅡ・v15追加）

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

```
AIInvestigationPort（インターフェース）← Application層が依存する抽象
  ├─ GeminiAIInvestigationAdapter      ← フェーズ0：ハッカソン本体（Gemini API直接）
  ├─ VertexAIInvestigationAdapter      ← フェーズ1：Vertex AI SDK経由（推奨経路）
  └─ ADKAgentInvestigationAdapter      ← フェーズ2：ADKエージェント構成（in-process・a2a不使用）
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

### MonitoringEventの設計原則

- 単一の `MonitoringEvent` 型にすべてのECイベントをマッピングする
- ECコンテキストの型をMonitoringコンテキストに直接importしない
- `payload: Record<string, unknown>` として均質に扱い、将来のECイベント追加でMonitoringドメインモデルが変わらない構造にする

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
- `DemoDrawer.tsx` は `/alerts` のレイアウト層にのみ差し込む
- ApplicationService / CommandHandler は `Logger` interfaceにのみ依存し、GCP固有実装を直接importしない
- ApplicationServiceのメソッド名は `run()` で統一する（CodelyTV準拠）
- Domain・Application層はHTTPステータスコードを知らない。errorHandlerがHTTPへの変換責務を持つ
- 外部サービスへのアウトバウンドポートは `XxxGateway` と命名する
- ドメインサービスを作る場合は `XxxDomainService` と明示的にサフィックスをつける
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

---

## 変更履歴

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

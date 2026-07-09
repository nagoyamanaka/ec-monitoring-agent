# Step 1: ディレクトリ構成（詳細設計）

> 本ドキュメントは設計エージェント向けプロンプト由来の Step 1 詳細設計です。
> 元資料の設計背景・制約・ハッカソン要件は元資料を参照してください。
>
> **2026-06-29 実コード照合**: Monitoring コンテキストの構成が当初設計から進化したため、以下を実体に合わせて修正済み。
> - `Monitoring/Remediation/`（top-level）は廃止 → `AIInvestigation/{domain,infrastructure}/remediation/` に内包。
> - `Monitoring/Forecast/`（stretchⅡ・予兆）は**未実装**（設計案のみ。現コードに存在しない）。
> - ADK マルチエージェントは「将来実装」ではなく**実装済み**（`AIInvestigation/infrastructure/adk/`）。
> - `VertexLLMClient` は未実装。代わりに `StubLLMClient`（`AI_INVESTIGATION_STUB` 用）が存在。
>
> ファイル単位の最新の正準は step4 系（特に `step4-2-monitoring-context.md`）を参照。

---

## 設計判断メモ（本ドキュメント確定時の議論）

| 判断項目                                  | 決定内容                                                                                                                                                                                                                                        | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| アプリのプロセス分割                      | `ec/backend` と `backoffice/backend` を別プロセスに分離                                                                                                                                                                                         | 将来のスケーリング時にプロセス単位でコンテナスケールアウトできる。コンテキスト分離を構成で体現できる                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| RabbitMQ Subscriberの配置                 | 各バックエンドプロセス内に内包                                                                                                                                                                                                                  | Subscriberは「そのイベントを使いたいコンテキストが自分で持つ」のがEDAの自然な形。中央集権化するメリット（共通処理の集約）がない                                                                                                                                                                                                                                                                                                                                                                                                                      |
| フロントエンドのディレクトリ構成          | **feature-sliced（校正版）**：`features/<feature>/{domain,application,infrastructure,presentation}` ＋ `shared/`。domain は「型＋純関数」のみ（バックエンドの集約は複製しない）。**正準は `step4-4-backoffice-frontend.md`**                       | 当初は layer-first（pages/components/hooks/infrastructure）を採用したが、予兆ブリーフィングUI（`features/forecast/`）等の機能追加で feature 境界が増えるため、feature 単位で凝集させる feature-sliced に変更。既存 feature を無傷で新 feature を足せる（OCP）。各レイヤーの粒度は校正し過剰設計を回避（`domain` は型＋view-logic、`application` は薄いユースケース、`infrastructure` の SSE/HttpClient 抽象が最も価値）。詳細・正準構成は `step4-4-backoffice-frontend.md` を正とする |
| SSE通信の抽象化                           | `AlertStream` interfaceで抽象化                                                                                                                                                                                                                 | SSEとMockの切り替えに実際の意味がある。REST APIは抽象化しない（プロトコル変更シナリオが現実的にない）                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| HTTPクライアント                          | fetchベースの薄いラッパーを自前実装（axiosを使わない）                                                                                                                                                                                          | サプライチェーンインシデントリスク回避。標準APIで主要機能（エラーハンドリング・タイムアウト・ヘッダー）を賄える。実装はAIに委譲                                                                                                                                                                                                                                                                                                                                                                                                                      |
| HTTPクライアントの抽象化                  | `HttpClient` interfaceを定義し `FetchHttpClient` が実装                                                                                                                                                                                         | `alertsApi.ts` 等はinterfaceに依存することでテスト時のモック差し替えが可能になる                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| デモ系コンポーネントの配置                | `components/demo/` に完全に閉じ込め、`AlertsLayout` のみで参照                                                                                                                                                                                  | プロダクションUIへの非侵食。`AlertDetailPage` 等はデモの存在を知らない構造                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Shared/domain の value-object 設計        | CodelyTV の `value-object/` サブディレクトリをそのまま流用（`Uuid` / `StringValueObject` / `NumberValueObject` / `EnumValueObject`）                                                                                                            | UUID バリデーション・Primitive 型制約・列挙型検証を基底クラスに集約。ECドメインの VO が `extends Uuid` / `extends NumberValueObject` 等で簡潔になる                                                                                                                                                                                                                                                                                                                                                                                                  |
| Shared/domain の CQRS 基盤追加            | `Command` / `CommandBus` / `CommandHandler` / `Query` / `QueryBus` / `QueryHandler` / `Response` を追加                                                                                                                                         | CodelyTV 準拠。Step 3 のアプリケーション層で CommandHandler<T> を実装する際の基盤                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Logger.ts の CodelyTV 版不採用            | `Logger.ts` は独自の `StructuredLog` 設計を維持。abstract class として `write(log): Promise<void>` を強制し、`debug/info/warn/error/fatal` のコンビニエンスメソッドを提供（いずれも `write()` に委譲）。CodelyTV 版の単純文字列ログは採用しない | GCP Cloud Logging への OTel 連携で構造化ログが必須。`trace_id`/`span_id` は OTel SDK がアクティブスパンから自動付与するため `StructuredLog` 型には含めない。`OTelLogger.buildEntry()` が spanContext から条件付きで出力する                                                                                                                                                                                                                                                                                                                          |
| DomainEvent.fromPrimitives シグネチャ変更 | 旧: `(aggregateId, body, eventId, occurredOn)` → 新: `{aggregateId, eventId, occurredOn, attributes}` named params                                                                                                                              | CodelyTV 準拠。RabbitMQ Subscriber がデシリアライズ時に呼び出すシグネチャを統一                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AIInvestigationのレポート設計             | `InvestigationReport` に `investigationSteps` / `suggestedActions` / `reviewStatus` を持たせる                                                                                                                                                  | 「AIが調査して人間はレビューするだけ」という体験価値を実現するため。保守業務における対向先起因の障害調査を自動化するというサービスの核心。分類ツールではなく調査エージェントとして機能させる                                                                                                                                                                                                                                                                                                                                                         |
| レビューステータスの管理                  | `reviewStatus: PENDING_REVIEW / APPROVED / REJECTED` を `InvestigationReport` に持たせる                                                                                                                                                        | 承認/却下フィードバックを既存の `SubmitFeedbackCommandHandler` に統合できる。新規コンテキスト不要                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **仮完成後の優先追加実装**                | `SimilarPatternRule`（kind=SIMILARITY・Elastic を内包）を `ApplicationClassificationPolicy` の Rule として追加する                                                                                                                             | ハッカソン本体完成後のROIが最も高い追加実装。工数約6時間。`AnalyzeAlertCommandHandler` は `AlertClassifier` IF にのみ依存し、追加は Policy の Rule 配列に足すだけ（`ClassificationRuleSorter` が SIMILARITY を自動配置）で既存コードをノータッチ。`KnownPatternRule`（完全一致・confidence 1.0固定）に対し、BM25スコアリングによるconfidence実数値化が実現できる。`Shared/infrastructure/persistence/elasticsearch/` に `ElasticClientFactory` / `ElasticCriteriaConverter` が既に設計済みのため追加コストが低い |
| **AIInvestigationPort の命名設計**        | ポート名を `AIInvestigationPort` のまま維持。実装クラス名のみ差し替え先を明示する                                                                                                                                                               | ポートはプロダクト名に依存しない抽象名にすることで、Gemini API直接 → Vertex AI SDK → ADK エージェントへの段階移行においてApplication層・Domain層がノータッチになる。ハッカソン要件（GCP必須・Gemini API）を現行実装で満たしつつ、将来の評価点強化をInfrastructure層の差し替えのみで実現できる                                                                                                                                                                                                                                                        |
| **マルチエージェントをa2aでなくADK in-processで構成**   | `AIInvestigationPort` の裏に ADK の Coordinator + 専門agent（Evidence/RootCause/Remediation）を1プロセス内で構成。a2aは使わない | マルチエージェント分割（並列専門調査・自律的な証拠追加収集ループ）はa2aなしでADKサブエージェントで実現できる。a2aは異ベンダー/別ランタイム相互運用（Elastic Agent Builder↔Gemini）専用で本構成には不要。ポートの継ぎ目で単一Gemini→ADKを差し替えるため、フェーズ0で提出可能状態を確保したまま段階的に載せられる |
| **調査(read)とリメディエーション(write)の分離** | 調査系Gateway（CloudLogging/Terraform/GitHub）は読み取り専用。write操作はPR起票のみで `RemediationPort`（`GitHubPullRequestGateway`）に隔離。自動マージしない | 「AIが調査・人間がレビューして承認」という体験価値（reviewStatus）を構造で体現する。CIで検出した脆弱性をMonitoringEvent(SECURITY)化し同一調査パイプラインに流すことで、DevOps（まわす）×AIエージェントの必然性を示す。PR草案は人間がレビューする成果物 |
| **予兆ブリーフィング（reactive→proactive）をstretchⅡとして追加（stretchⅡ）** | `Monitoring/Forecast/` を新規モジュールとして追加。既存の反応的パイプライン（AnalyzeAlert/InvestigateAlert）は**一切変更しない**。`RiskForecast` を Alert と別の read-model にし、`ForecastRiskCommandHandler` を横に生やす（全て read-only・write無し） | 「起きたこと」の調査だけでなく「これから落ちそうな箇所」を**既知の未来シグナル（未マージPR/未適用plan/スケジュール）×蓄積した過去事例**から推論する差別化。予測は統計MLでなく**LLM推論＋引用検証**で構成し、joinはLLMに委譲（自前ルールエンジンを作らない）。突合キーは(B)構造化タグ方式（`ForecastMemory` projection）。詳細は `step4-1` 7章・`step4-2` 予兆節 |

---

## `src/Contexts/Shared/`

```
src/Contexts/Shared/
├── domain/
│   ├── AggregateRoot.ts          # DomainEventを蓄積・pullDomainEvents()で取り出す基底クラス。abstract toPrimitives()を強制
│   ├── DomainEvent.ts            # イベント基底クラス。fromPrimitives は {aggregateId,eventId,occurredOn,attributes} の named params
│   ├── DomainEventSubscriber.ts  # イベント購読インターフェース（subscribedTo/on）
│   ├── EventBus.ts               # イベントバスインターフェース（publish）
│   ├── Command.ts                # CQRS コマンド基底クラス
│   ├── CommandBus.ts             # コマンドバスインターフェース
│   ├── CommandHandler.ts         # CommandHandler<T> インターフェース（subscribedTo/handle）
│   ├── Query.ts                  # CQRS クエリ基底クラス
│   ├── QueryBus.ts               # クエリバスインターフェース
│   ├── QueryHandler.ts           # QueryHandler<Q,R> インターフェース
│   ├── Response.ts               # クエリ応答マーカーインターフェース
│   ├── NewableClass.ts           # ユーティリティ型
│   ├── Nullable.ts               # T | null | undefined ユーティリティ型
│   ├── errors/
│   │   ├── AppError.ts           # エラーインターフェース（errorCode/message）
│   │   ├── DomainError.ts        # ドメインエラー基底（Error + AppError 実装）
│   │   ├── ApplicationError.ts   # アプリケーションエラー基底
│   │   ├── InfrastructureError.ts # インフラエラー基底
│   │   ├── InvalidArgumentError.ts # VO構築失敗の基底エラー（errorCode: INVALID_ARGUMENT）
│   │   └── InvalidDomainEventNameError.ts # ECDomainEventのプレフィックス違反（errorCode: INVALID_DOMAIN_EVENT_NAME）
│   ├── value-object/             # CodelyTV準拠のValue Object基底クラス群
│   │   ├── ValueObject.ts        # T extends Primitives 制約 + null guard + equals
│   │   ├── StringValueObject.ts  # ValueObject<string> 抽象基底
│   │   ├── NumberValueObject.ts  # ValueObject<number> 抽象基底（isBiggerThan）
│   │   ├── EnumValueObject.ts    # 列挙型VO基底（validValues + checkValueIsValid）
│   │   └── Uuid.ts               # UUID v4 バリデーション付きVO
│   ├── criteria/
│   │   ├── Criteria.ts           # 検索条件ルートオブジェクト（filters/order/limit/offset）
│   │   ├── Filter.ts             # FilterField + FilterOperator + FilterValue の集約
│   │   ├── FilterField.ts        # StringValueObject派生のフィールド名VO
│   │   ├── FilterValue.ts        # StringValueObject派生のフィルタ値VO
│   │   ├── Filters.ts            # Filter[]のコレクション
│   │   ├── FilterOperator.ts     # Operator enum + EnumValueObject（= != > < CONTAINS NOT_CONTAINS）
│   │   ├── Order.ts              # OrderBy + OrderType を持つソート条件（none/asc/desc ファクトリ）
│   │   ├── OrderBy.ts            # StringValueObject派生のソートフィールドVO
│   │   └── OrderType.ts          # OrderTypes enum + EnumValueObject（asc/desc/none）
│   └── logging/
│       ├── Logger.ts             # ログ書き込み抽象クラス（abstract write(log): Promise<void> + debug/info/warn/error/fatal コンビニエンスメソッド）※GCP OTel要件のため独自設計を維持
│       └── StructuredLog.ts      # ログスキーマの型定義（severity/service/action/messageなど。trace_id/span_idはOTelが自動付与するため含まない）
├── application/
│   └── errors/
│       ├── CommandNotRegisteredError.ts  # ApplicationError派生（COMMAND_NOT_REGISTERED）
│       └── QueryNotRegisteredError.ts    # ApplicationError派生（QUERY_NOT_REGISTERED）
└── infrastructure/
    ├── CommandBus/
    │   ├── InMemoryCommandBus.ts         # CommandBus実装（Handler map管理）
    │   └── CommandHandlers.ts            # CommandHandlerの登録・解決
    ├── QueryBus/
    │   ├── InMemoryQueryBus.ts           # QueryBus実装
    │   └── QueryHandlers.ts              # QueryHandlerの登録・解決
    ├── EventBus/
    │   ├── DomainEventJsonSerializer.ts  # DomainEvent→JSONシリアライズ
    │   ├── DomainEventDeserializer.ts    # JSON→DomainEventデシリアライズ
    │   ├── DomainEventSubscribers.ts     # Subscriberの登録管理
    │   ├── DomainEventFailoverPublisher/
    │   │   └── DomainEventFailoverPublisher.ts  # 発行失敗時のリトライ処理
    │   ├── InMemory/
    │   │   └── InMemoryAsyncEventBus.ts  # テスト用インメモリEventBus
    │   └── RabbitMq/
    │       ├── RabbitMqEventBus.ts              # RabbitMQ EventBus実装
    │       ├── RabbitMqConnection.ts            # 接続管理
    │       ├── RabbitMQConfigurer.ts            # Exchange/Queue設定
    │       ├── RabbitMQConsumer.ts              # メッセージ消費処理
    │       ├── RabbitMQConsumerFactory.ts
    │       ├── RabbitMQExchangeNameFormatter.ts # Exchange命名規則
    │       ├── RabbitMQQueueNameFormatter.ts    # Queue命名規則
    │       ├── ConnectionSettings.ts
    │       └── ExchangeSetting.ts
    ├── errors/
    │   └── LogWriteError.ts              # InfrastructureError派生（ログ書き込み失敗）
    ├── logging/
    │   ├── FileLogger.ts                 # Logger実装（OTel経由でファイル出力）
    │   └── OTelLogger.ts                 # Logger実装（OTel Collector送信・将来拡張用）
    └── persistence/
        ├── mongo/
        │   ├── MongoClientFactory.ts     # MongoDB接続ファクトリ
        │   ├── MongoConfig.ts            # 接続設定
        │   ├── MongoRepository.ts        # 抽象MongoDBリポジトリ基底（MongoClient DI・persist/searchByCriteria提供）
        │   └── MongoCriteriaConverter.ts # Criteria→MongoDBクエリ変換（MongoRepository内部で使用）
        ├── elasticsearch/
        │   ├── ElasticClientFactory.ts
        │   ├── ElasticConfig.ts
        │   ├── ElasticCriteriaConverter.ts  # Criteria→Elasticsearchクエリ変換
        │   └── ElasticRepository.ts
        └── drizzle/                      # 将来のRDB移行時用（現在未使用）
            ├── DrizzleClientFactory.ts
            ├── DrizzleConfig.ts
            ├── DrizzleRepository.ts
            └── ValueObjectTransformer.ts
```

---

## `src/Contexts/EC/`

```
src/Contexts/EC/
├── Shared/
│   └── domain/
│       └── ECDomainEvent.ts      # ECコンテキスト共通のDomainEvent基底（EVENT_NAME prefix: 'ec.'）
│
├── Orders/
│   ├── domain/
│   │   ├── Order.ts                                       # Order集約ルート（AggregateRoot継承）
│   │   ├── OrderId.ts                                     # Value Object（Uuid継承）
│   │   ├── OrderStatus.ts                                 # Value Object（PENDING/CONFIRMED/FAILED）
│   │   ├── OrderItems.ts                                  # Value Object（OrderItemの集合）
│   │   ├── OrderItem.ts                                   # Value Object（productId/quantity/price）
│   │   ├── CustomerId.ts                                  # Value Object（Uuid継承）
│   │   ├── SubtotalAmount.ts                              # Value Object
│   │   ├── PaymentGateway.ts                              # 決済ゲートウェイインターフェース（PaymentResult型含む）
│   │   ├── OrderRepository.ts                             # Repositoryインターフェース（Domain層）
│   │   └── OrderPlacedDomainEvent.ts                      # 注文確定イベント
│   ├── application/
│   │   ├── PlaceOrder/
│   │   │   ├── PlaceOrderCommand.ts                       # 注文作成コマンド
│   │   │   ├── PlaceOrderCommandHandler.ts                # コマンドハンドラ（VO変換のみ → UseCase委譲）
│   │   │   ├── PlaceOrderUseCase.ts                       # ビジネスロジック本体（Payment・save・EventPublish・Logger）
│   │   │   └── PlaceOrderFailedError.ts                   # ApplicationError（決済失敗）
│   │   └── GetOrder/
│   │       ├── GetOrderQuery.ts                           # 注文取得クエリ
│   │       ├── GetOrderQueryHandler.ts                    # クエリハンドラ（VO変換のみ → UseCase委譲）
│   │       └── GetOrderUseCase.ts                         # ビジネスロジック本体（findById・NotFound・レスポンス変換）
│   └── infrastructure/
│       ├── persistence/
│       │   ├── MongoOrderRepository.ts                    # OrderRepository MongoDB実装（MongoRepository継承）
│       │   └── InMemoryOrderRepository.ts                 # OrderRepository インメモリ実装（UT用）
│       └── subscribers/
│           └── (なし。Orderは発行側のみ)
│
├── Inventory/
│   ├── domain/
│   │   ├── Inventory.ts                                   # Inventory集約ルート（AggregateRoot継承）
│   │   ├── ProductId.ts                                   # Value Object（Uuid継承）
│   │   ├── StockQuantity.ts                               # Value Object（0以下を許容しない制約）
│   │   ├── InventoryRepository.ts                         # Repositoryインターフェース（Domain層）
│   │   ├── InventoryReservedDomainEvent.ts                # 在庫引き当て成功イベント
│   │   └── InventoryReservationFailedDomainEvent.ts       # 在庫引き当て失敗（既知障害デモの核心）
│   ├── application/
│   │   └── ReserveInventory/
│   │       ├── ReserveInventoryUseCase.ts                 # ビジネスロジック本体（Phase1/Phase2/リトライ/イベント発行）
│   │       └── ReserveInventoryOnOrderPlaced.ts           # OrderPlacedを購読してUseCase直接呼び出し（CommandBus不使用）
│   └── infrastructure/
│       └── persistence/
│           ├── MongoInventoryRepository.ts                # InventoryRepository MongoDB実装（MongoRepository継承・reserveStockはfindOneAndUpdateで楽観ロック）
│           └── InMemoryInventoryRepository.ts             # InventoryRepository インメモリ実装（UT用・楽観ロックのバージョンチェックを再現）
│
└── Payment/
    ├── domain/
    │   └── PaymentTimeoutDomainEvent.ts                   # 決済タイムアウトイベント（シナリオ1の核心）
    └── infrastructure/
        └── PaymentMockGateway.ts                          # モック決済（success/random/timeout切り替え）
```

---

## `src/Contexts/Monitoring/`

```
src/Contexts/Monitoring/
├── Shared/
│   └── domain/
│       └── MonitoringEvent.ts                 # ECDomainEventから変換された監視イベント（拡張ポイント）
│
├── AlertAnalysis/
│   ├── domain/
│   │   ├── Alert.ts                           # Alert集約ルート
│   │   ├── AlertId.ts                         # Value Object
│   │   ├── AlertSeverity.ts                   # Value Object（CRITICAL/WARNING/INFO）
│   │   ├── AlertStatus.ts                     # Value Object（OPEN/ANALYZING/RESOLVED）
│   │   ├── InvestigationReport.ts            # AI調査レポート（Alert集約のサブエンティティ＝集約の構成要素なのでここに置く）
│   │   │                                      #   summary / confidence / investigationSteps / suggestedActions / suggestedPatternName / reviewStatus
│   │   │                                      #   ※ Alert集約に埋め込まれる部品なので所有者は AlertAnalysis。生成元（AIInvestigation/Port）が逆にこちらへ依存する
│   │   ├── ReviewStatus.ts                    # Value Object（PENDING_REVIEW / APPROVED / REJECTED）。reviewStatusはSubmitFeedbackCommandHandlerで更新
│   │   ├── KnownErrorPattern.ts               # 既知障害パターンエンティティ
│   │   ├── AlertRepository.ts                 # Repositoryインターフェース
│   │   └── KnownErrorPatternRepository.ts     # Repositoryインターフェース
│   ├── application/
│   │   ├── AnalyzeAlert/
│   │   │   ├── AnalyzeAlertCommand.ts
│   │   │   ├── AnalyzeAlertCommandHandler.ts  # VO変換のみ → UseCase委譲
│   │   │   └── AnalyzeAlertUseCase.ts         # 既知/未知分類ロジック本体（テストはここに書く）
│   │   ├── CollectMonitoringEvent/            # 観測イベント収集（ingest）ユースケース。AnalyzeAlertとは責務が別なので独立フォルダ
│   │   │   ├── CollectMonitoringEventUseCase.ts            # 源非依存：MonitoringEvent → AnalyzeAlertCommand 生成 → ハンドラ委譲
│   │   │   ├── CollectMonitoringEventSubscriber.ts         # 抽象基底（テンプレートメソッド）。源固有差分は subscribedTo()/toMonitoringEvent() のみ＝OCP
│   │   │   ├── CollectMonitoringEventOnECEventPublished.ts # EC源アダプタ：EC DomainEvent → MonitoringEvent 変換（橋渡し）
│   │   │   ├── CloudMonitoringAlertTranslator.ts          # Cloud Monitoring 源アダプタ（ingest 境界で正規化）
│   │   │   └── SecurityScanTranslator.ts                  # CI(Trivy/npm audit) 源アダプタ（ingest 境界で正規化）
│   │   ├── SubmitFeedback/                    # フィードバック受付・レポートレビュー結果の記録
│   │   ├── PromotePattern/                    # フィードバック起点の既知パターン自動昇格
│   │   ├── GetAlert/ GetAlertReport/          # CQRS Read（一覧・詳細・調査レポート）
│   │   ├── GetKnownErrorPatterns/             # CQRS Read（既知パターン一覧）
│   │   ├── GetAnalytics/                      # CQRS Read（分類精度・件数の分析ビュー）
│   │   └── errors/                            # AlertAnalysis 固有のアプリ層エラー
│   ├── domain/
│   │   ├── classification/                    # 【実装済み】AlertClassifier 3層（policies/ ＋ rules/）
│   │   ├── promotion/                         # 既知昇格ドメインロジック
│   │   └── contracts/                         # front/back 共有のワイヤ契約 re-export
│   └── infrastructure/
│       ├── persistence/
│       │   ├── InMemory/Mongo AlertRepository.ts
│       │   └── InMemory/Mongo KnownErrorPatternRepository.ts
│       └── readmodel/                         # 一覧/詳細用 read-model 投影（save デコレータ経由）
│       # Subscriber本体は application/CollectMonitoringEvent/ に配置（CompensateOrderOnInventoryFailed と同じく application 層）。
│       # DomainEventBus への配線は app の合成ルート src/apps/backoffice/backend/src/subscribers/ で行う
│
├── AIInvestigation/
│   ├── domain/
│   │   # ※ InvestigationReport / ReviewStatus は Alert集約のサブエンティティなので AlertAnalysis/domain に置く（ここには置かない）。
│   │   #   AIInvestigation は「Reportを生成する補助モジュール」なので AlertAnalysis/domain（InvestigationReport）へ依存する＝依存は一方向（AIInvestigation → AlertAnalysis）。
│   │   ├── InvestigationContext.ts            # Geminiへ送るコンテキストの型（トークン上限3,500）
│   │   ├── AIInvestigationPort.ts             # AI調査呼び出しのポートインターフェース（DIP）
│   │   │                                      # ※ プロダクト名を含まない抽象名にすることで
│   │   │                                      #   Gemini直接 → Vertex AI SDK → ADK エージェント
│   │   │                                      #   への段階移行でApplication層がノータッチになる
│   │   ├── LLMTextClient.ts                   # LLMへの最小契約「text in → text out」（generate(systemInstruction, prompt)）
│   │   │                                      # ※ LLMInvestigationAdapter が DI で受け取る部品。プロバイダ固有呼び出しとリトライのみを抽象化
│   │   ├── InfraInvestigationPort.ts          # インフラ証拠収集の driven ポート（Application層が依存する抽象）
│   │   └── InfraEvidence.ts                   # domain が消費する正規化済みDTO（appLogs / terraformDiff / recentCommits）
│   ├── application/
│   │   └── InvestigateAlert/
│   │       ├── InvestigateAlertOnAlertClassifiedUnknown.ts # InvestigateAlertDomainEvent を EventBus 経由で購読（DomainEventSubscriber）
│   │       │                                             #   on()＝event→VO変換 → UseCase委譲（薄い）。旧 InvestigateAlertCommand(Handler) を統合
│   │       └── InvestigateAlertUseCase.ts        # 未知障害時にAIへ投げ、InvestigationReportを生成・保存（ロジック本体）
│   │                                             # ※ AIInvestigationPort にのみ依存。実装切り替えでノータッチ
│   └── infrastructure/
│       ├── aiinvestigation/                   # 【ハッカソン現行実装】調査オーケストレーション＋LLMクライアント（コンポジション）
│       │   ├── LLMInvestigationAdapter.ts      # AIInvestigationPort実装。薄いオーケストレーション
│       │   │                                  #   プロンプト構築→LLM呼び出し（委譲）→パース→マッピングを組み合わせるだけ
│       │   │                                  # ※ LLMTextClient を DI で受け取り委譲（継承ではなくコンポジション＝SRP遵守）
│       │   ├── InvestigationPromptBuilder.ts   # プロンプト構築＋トークン3500予算管理（純関数・UT対象）
│       │   ├── LLMOutputParser.ts             # LLM生テキスト→構造化スキーマ（フェンス抽出・検証・純関数・UT対象）
│       │   ├── InvestigationReportMapper.ts    # 検証済み出力→InvestigationReport／fallback生成（confidenceクランプ・severityマッピング・UT対象）
│       │   ├── GeminiLLMClient.ts             # LLMTextClient実装。@google/generative-ai（Gemini API直接）
│       │   │                                  #   「text in → text out」＋呼び出しの信頼性（30sタイムアウト・1回リトライ）のみ担当
│       │   └── *.test.ts                      # 各純関数モジュール＋Adapter（fake LLMTextClient注入）のユニットテスト
│       │                                      # ※ infra実装でも疎通主体のリポジトリと違い、分岐ロジックが厚いのでE2Eでなくユニットテストで担保
│       │
│       ├── infrainvestigation/               # InfraInvestigationPort 実装 + ACL 内部 Gateway 群
│       │   ├── CloudLoggingGateway.ts        #   Gateway IF（ACL 内部シーム。DefaultInfraInvestigationAdapter のみが依存）
│       │   ├── CloudLoggingGatewayImpl.ts    #   Cloud Logging API（read-only）
│       │   ├── CloudMonitoringGateway.ts     #   Gateway IF（メトリクス取得）
│       │   ├── CloudMonitoringGatewayImpl.ts #   Cloud Monitoring API（read-only・メトリクス証拠）
│       │   ├── GitHubGateway.ts / GitHubGatewayImpl.ts      #   GitHub REST API（read-only）
│       │   ├── TerraformGateway.ts / TerraformGatewayImpl.ts #   Terraform CLI / git diff（read-only・適用済み差分）
│       │   ├── AppliedInfraChangeStore.ts    #   適用済み IaC 変更の記録ポート（demo 注入と TerraformGateway が共有）
│       │   ├── InMemoryAppliedInfraChangeStore.ts
│       │   └── DefaultInfraInvestigationAdapter.ts  # InfraInvestigationPort 実装（category 別に証拠源を出し分け）
│       │
│       ├── remediation/                       # 自律リメディエーション（write 操作を隔離。旧 Monitoring/Remediation を内包）
│       │   ├── RemediationPort 実装群:
│       │   ├── GitHubActionsRemediationDispatcher.ts # repository_dispatch で ai-remediation.yml を起動
│       │   ├── GitHubPullRequestGateway.ts    # PR 草案（人間承認ゲート。GITHUB_TOKEN 必須・対象リポジトリ限定）
│       │   ├── InProcessAdvisoryRemediation.ts # CI を起動せずプロセス内で助言のみ返す実装
│       │   ├── LLMRemediationPlanner.ts        # RemediationPlanner 実装（LLM で修正方針を立案）
│       │   └── InMemory/MongoRemediationRepository.ts # 起票結果の永続化
│       │
│       └── adk/                              # 【実装済み】ADKマルチエージェント（a2a不使用・1プロセス内）
│           ├── ADKAgentInvestigationAdapter.ts # AIInvestigationPort実装。Runner を起動するだけ（Port 直接実装）
│           ├── ADKInvestigationAgentRunner.ts  # ADK ランタイムでエージェントを走らせる本体
│           ├── InvestigationAgentRunner.ts     # ランナー抽象（テストで差し替え可能）
│           ├── agents/                         # サブエージェント定義（証拠収集・原因分析・リメディ立案）
│           └── tools/                          # エージェントが使う tool 群（infrainvestigation の Gateway を委譲）
│       # ※ StubLLMClient.ts（aiinvestigation/）が AI_INVESTIGATION_STUB=true 時の決定的応答を担う（VertexLLMClient は未実装）
│
├── AlertNotification/
│   ├── domain/
│   │   └── SSEAlertNotifier.ts                # SSE通知インターフェース（notify/addConnection/removeConnection）
│   └── infrastructure/
│       └── EventEmitterSSEAlertNotifier.ts    # SSEAlertNotifier実装（Node.js EventEmitter・タスク13）
│
└── SimilarIncident/
    ├── domain/
    │   ├── SimilarIncident.ts                 # 類似インシデントエンティティ
    │   └── SimilarIncidentRepository.ts       # インターフェース（findSimilar/index）
    └── infrastructure/
        ├── InMemorySimilarIncidentRepository.ts  # 今回の実装（起動時にMongoからウォームアップ）
        └── InMemoryCriteriaConverter.ts          # Criteria→array filter/sort変換
```

### AlertClassifier 拡張ロードマップ（Policy / Rule / Sorter・仮完成後の優先実装）

分類は3層（`AlertClassifier`（IF）→ `ClassificationPolicy`（category単位）→ `ClassificationRule`（最小単位・依存を内包））。**3層の骨格と `KnownPatternRule`（EXACT_MATCH）は実装済み**（`domain/classification/{policies,rules}/`）。以下は今後の拡張ロードマップ。拡張は「Classifier 丸ごと差し替え」ではなく「**Policy に Rule を足す**」。各 Rule は `kind`（EXACT_MATCH/SIMILARITY/INFERENCE）を持ち、`ClassificationRuleSorter` が kind 優先順位で並べる。

```
PolicyBasedAlertClassifier（AlertClassifier 実装）
  └─ ApplicationClassificationPolicy
       ├─ KnownPatternRule      ← ハッカソン本体（kind=EXACT_MATCH・完全一致・confidence 1.0固定）
       ├─ SimilarPatternRule    ← 仮完成後に追加（kind=SIMILARITY・Elastic BM25スコアリング・confidence実数値）
       └─ AiInferenceRule       ← 将来（kind=INFERENCE・AI port 内包）
```

**追加ファイル（既存コードへの変更ゼロ）**

```
src/Contexts/Monitoring/AlertAnalysis/domain/classification/rules/
└── SimilarPatternRule.ts                 # ClassificationRule実装（Elastic を内包・BM25スコア→confidence）
                                          # Policy の Rule 配列に足すだけ。Sorter が SIMILARITY を自動配置

src/Contexts/Shared/infrastructure/persistence/elasticsearch/
├── ElasticClientFactory.ts               # 設計済み（追加コストなし）
├── ElasticConfig.ts                      # 設計済み（追加コストなし）
└── ElasticCriteriaConverter.ts           # 設計済み（追加コストなし）
```

**実装方針メモ（ADR説明用）**

- 既知パターンをElasticsearchにインデックスし、MonitoringEventのeventName/payloadをクエリとして投げる
- BM25スコアを `confidence` にマッピング（スコア正規化）
- `AnalyzeAlertCommandHandler` はインターフェースにのみ依存しているため差し替えでノータッチ
- 「将来できます」ではなく「実装済みです」として説明できる状態にすることがポートフォリオ価値の核心
- 移行トリガー：自動昇格パターンが10件超、または `/analytics` で誤分類率が計測可能になった時点

### AIInvestigation 移行ロードマップ（ハッカソン初期プロトタイプ完了後）

```
フェーズ0（ハッカソン本体）
  LLMInvestigationAdapter + GeminiLLMClient
    LLMInvestigationAdapter が調査オーケストレーション（プロンプト/パース/マッピング/fallback）
    GeminiLLMClient が @google/generative-ai 直接呼び出し（text in → text out・リトライ）
    要件：Gemini API ✅

フェーズ1（ポートフォリオ強化・工数目安2〜3時間）
  LLMTextClient を VertexLLMClient へ差し替え
    @google-cloud/vertexai SDK 経由
    LLMInvestigationAdapter も InvestigateAlertOnAlertClassifiedUnknown もノータッチ（DI差し替え1箇所）
    要件：Gemini API（Vertex AI経由・推奨） ✅✅

フェーズ2（マルチエージェント構成・工数目安1日）
  ADKAgentInvestigationAdapter へ差し替え（AIInvestigationPort を直接実装）
    Google ADK でエージェント構成。自前オーケストレーションのため LLMInvestigationAdapter/LLMTextClient は経由しない
    InvestigateAlertOnAlertClassifiedUnknown ノータッチ
    要件：Gemini Enterprise Agent Platform + ADK ✅✅✅
```

**設計上の配慮（今すぐ実施済み）**

- `AIInvestigationPort` のポート名にプロダクト名を含めない
- `InvestigateAlertOnAlertClassifiedUnknown` はポートインターフェースにのみ依存
- Infrastructure層のファイルとして将来実装のプレースホルダー名を設計ドキュメントに明記
- フェーズ移行時の変更箇所はDIの差し替え1箇所のみ（`EcBackendApp.ts` のファクトリ関数で差し替え）

---

## `src/apps/`

### `ec/backend/`

```
src/apps/ec/backend/
├── src/
│   ├── start.ts                     # エントリーポイント（EcBackendApp.start()）
│   ├── EcBackendApp.ts              # DIセットアップ・インフラ初期化・アプリ起動
│   ├── server.ts                    # Expressサーバークラス（listen/stop）
│   ├── routes/
│   │   ├── index.ts                 # registerRoutes（全ルートを集約）
│   │   ├── orders.route.ts          # POST /orders, GET /orders/:orderId
│   │   └── demo.route.ts            # POST /demo/payment-mode
│   ├── controllers/
│   │   ├── orders/
│   │   │   ├── OrdersPostController.ts  # PlaceOrderCommandをディスパッチ
│   │   │   └── OrderGetController.ts    # GetOrderQueryをディスパッチ
│   │   └── demo/
│   │       └── PaymentModePostController.ts
│   ├── middleware/
│   │   └── errorHandler.ts          # DomainError/ApplicationError/InfrastructureError → HTTPステータス変換
│   └── subscribers/
│       └── EcSubscribers.ts         # buildEcSubscribers()（DomainEventSubscribersを構築して返す）
└── package.json
```

### `backoffice/backend/`

```
src/apps/backoffice/backend/
├── src/
│   ├── start.ts                     # エントリーポイント（BackofficeApp.start()）
│   ├── BackofficeApp.ts             # DIセットアップ・インフラ初期化・アプリ起動
│   ├── server.ts                    # Expressサーバークラス（listen/stop）
│   ├── routes/
│   │   ├── alertRoutes.ts           # GET /alerts, GET /alerts/:id, PATCH /alerts/:id/feedback
│   │   ├── evidenceRoutes.ts        # GET /alerts/:id/evidence, GET /alerts/:id/investigation/status（v12）
│   │   ├── remediationRoutes.ts     # POST /alerts/:id/remediation/draft-pr, GET /alerts/:id/remediation（v13）
│   │   ├── ingestRoutes.ts          # POST /ingest/security-scan（CIからの脆弱性スキャン受信。v13）
│   │   ├── patternRoutes.ts         # GET /patterns, POST /patterns/:id/promote
│   │   ├── analyticsRoutes.ts       # GET /analytics
│   │   ├── streamRoutes.ts          # GET /alerts/stream（SSEエンドポイント）
│   │   ├── forecastRoutes.ts        # POST /forecast, GET /forecast（予兆ブリーフィング・stretchⅡ。FORECAST_ENABLEDで本番無効化）
│   │   └── demoRoutes.ts            # POST /demo/** （環境変数で本番無効化）
│   ├── controllers/
│   │   ├── AlertsGetController.ts
│   │   ├── AlertGetController.ts
│   │   ├── AlertFeedbackPatchController.ts   # レポートレビュー（承認/却下）も同エンドポイントで受け付ける
│   │   ├── AlertEvidenceGetController.ts     # 収集済みInfraEvidence・調査ステータス取得（v12）
│   │   ├── RemediationDraftPrPostController.ts # 承認操作：RemediationPlanからPR草案を起票（v13）
│   │   ├── RemediationGetController.ts       # 起票済みPRのURL・ステータス取得（v13）
│   │   ├── SecurityScanIngestPostController.ts # CIスキャン結果→MonitoringEvent(SECURITY)化→AnalyzeAlert（v13）
│   │   ├── AlertsStreamController.ts        # SSEコネクション管理
│   │   ├── PatternsGetController.ts
│   │   ├── PatternPromotePostController.ts
│   │   ├── AnalyticsGetController.ts
│   │   ├── ForecastPostController.ts        # POST /forecast → ForecastRiskCommandHandler（stretchⅡ）
│   │   ├── ForecastGetController.ts         # GET /forecast → 最新RiskForecast read-model（stretchⅡ）
│   │   └── demo/
│   │       ├── DemoPaymentModePostController.ts
│   │       ├── DemoScenarioTriggerPostController.ts
│   │       ├── DemoResetPostController.ts   # 全体リセット + シードデータ投入
│   │       └── DemoStatusGetController.ts
│   └── subscribers/
│       └── BackofficeSubscribers.ts   # 合成ルート：CollectMonitoringEventOnECEventPublished を DomainEventSubscribers に配線（EcSubscribers.ts と同形）
└── package.json
```

### `backoffice/frontend/`

> **正準は `step4-4-backoffice-frontend.md`（feature-sliced・校正版）。** 本書はその要約。
> 構成は `features/<feature>/{domain,application,infrastructure,presentation}` ＋ `shared/`。
> `domain` は「型＋純関数（view-logic）」のみ（バックエンドの集約は複製しない）。

```
src/apps/backoffice/frontend/src/
├── main.tsx                         # Reactエントリポイント
├── App.tsx                          # ルーティング定義（React Router）/alerts, /alerts/:id, /analytics, /forecast
│
├── features/
│   ├── alerts/                      # メイン機能
│   │   ├── domain/                  # 型＋純関数のみ
│   │   │   ├── AlertView.ts             # 表示用型（classification.confidence / category 等）
│   │   │   ├── InvestigationReportView.ts # investigationSteps / suggestedActions / reviewStatus
│   │   │   ├── EvidenceView.ts          # InfraEvidence の表示型（appLogs/terraformDiff/recentCommits・P1）
│   │   │   ├── RemediationView.ts       # PR URL / ステータス（P1・SECURITY）
│   │   │   └── severity.ts              # 純関数：severity→バッジ色、confidence→%表記
│   │   ├── application/             # 薄いユースケース
│   │   │   ├── submitFeedback.ts        # 承認/却下 → PATCH /alerts/:id/feedback
│   │   │   └── approveRemediation.ts    # 承認 → POST /alerts/:id/remediation/draft-pr（P1）
│   │   ├── infrastructure/         # APIクライアント＋SSE（最も価値ある抽象）
│   │   │   ├── alertsApi.ts             # GET /alerts, GET /alerts/:id, PATCH feedback（HttpClient依存）
│   │   │   ├── evidenceApi.ts           # GET /alerts/:id/evidence, /investigation/status（P1）
│   │   │   ├── remediationApi.ts        # POST draft-pr, GET remediation（P1）
│   │   │   ├── AlertStream.ts           # SSEストリーム interface（Mock差し替え可能）
│   │   │   ├── SSEAlertStream.ts        # AlertStream の SSE実装（/alerts/stream・再接続・heartbeat無視）
│   │   │   └── MockAlertStream.ts       # テスト/デモ用 AlertStream 実装
│   │   └── presentation/
│   │       ├── pages/
│   │       │   ├── AlertsPage.tsx       # /alerts（デモのメイン舞台・AlertsLayout）
│   │       │   └── AlertDetailPage.tsx  # /alerts/:id（フル詳細・調査プロセス全表示・DefaultLayout）
│   │       ├── components/
│   │       │   ├── AlertList.tsx
│   │       │   ├── AlertCard.tsx        # アコーディオン展開カード
│   │       │   ├── AlertCardExpanded.tsx # AI分析結果＋調査ステップ＋推奨アクション＋[✓承認][✗却下]
│   │       │   ├── EvidencePanel.tsx    # Cloud Logging/Terraform/GitHub 証拠の積み上げ可視化（P1）
│   │       │   └── RemediationPanel.tsx # CVE概要＋修正PRリンク＋承認ボタン（P1・SECURITY）
│   │       └── hooks/
│   │           ├── useAlertStream.ts    # SSE接続（AlertStream interfaceを利用・同一ID置換・ANALYZING→OPEN）
│   │           └── useAlerts.ts         # 一覧取得＋ストリームのマージ
│   │
│   ├── analytics/
│   │   ├── infrastructure/analyticsApi.ts   # GET /analytics
│   │   └── presentation/pages/AnalyticsPage.tsx # /analytics（AI精度トラッキング）
│   │
│   ├── demo/                        # デモ系を完全に閉じ込める（プロダクションUI非侵食）
│   │   ├── infrastructure/demoApi.ts    # POST /demo/**
│   │   └── presentation/
│   │       ├── DemoDrawer.tsx           # デモコントロールドロワー本体（AlertsLayoutのみで参照）
│   │       ├── ScenarioControls.tsx     # シナリオ1〜5実行ボタン
│   │       ├── PaymentModeToggle.tsx    # 決済モード切り替え（OK/RD/TM）
│   │       ├── SystemStatus.tsx         # RabbitMQ接続・SSE接続数・インシデント数
│   │       └── hooks/useDemoControls.ts # デモAPIへのfetchフック
│   │
│   └── forecast/                    # 予兆ブリーフィング（stretchⅡ）。既存 feature 無傷で新設するだけ
│       ├── domain/
│       │   ├── ForecastView.ts          # RiskItem→level色・confidence→%（純関数）
│       │   └── RiskLevel.ts             # HIGH/MEDIUM/LOW（純関数のみ）
│       ├── application/triggerForecast.ts # POST /forecast 生成トリガー
│       ├── infrastructure/forecastApi.ts  # POST /forecast, GET /forecast（HttpClient依存）
│       └── presentation/
│           ├── pages/ForecastPage.tsx   # /forecast（リスク一覧・level降順）
│           └── components/
│               ├── RiskCard.tsx         # window・subject・levelバッジ・confidenceゲージ・reasoning
│               └── CitationList.tsx     # ★引用チップ（PR#123/schedule/incident#7）＝根拠の明示・ハルシネーション否定の可視化
│
├── shared/                          # features/* から参照可（逆は不可）
│   ├── api/
│   │   ├── HttpClient.ts                # interface（プロトコル非依存）
│   │   └── FetchHttpClient.ts           # fetch実装（baseURL・エラー・タイムアウト）。axios不使用
│   ├── ui/
│   │   └── SeverityBadge.tsx            # CRITICAL/WARNING/INFO バッジ（RiskLevel にも転用可）
│   └── layouts/
│       ├── AlertsLayout.tsx             # /alerts 専用（DemoDrawer をここだけで参照）
│       └── DefaultLayout.tsx            # /alerts/:id, /analytics（DemoDrawer非表示）
│
├── index.html
├── vite.config.ts
└── package.json
```

> **依存ルール**: `presentation → application, domain, infrastructure(interface)` / `application → infrastructure(interface), domain` / `infrastructure → shared/api(HttpClient), domain` / `domain` は依存なし（純粋）。`features/* → shared/*`（逆不可）、features 間の直接依存禁止（共有は shared に上げる）。`AlertsLayout → features/demo/DemoDrawer`（ここだけ）。

---

## 依存関係サマリー

```
# フロント（feature-sliced・正準は step4-4）
presentation → application, domain, infrastructure(interface)
application  → infrastructure(interface), domain
infrastructure → shared/api(HttpClient), domain
domain        → 依存なし（型＋純関数のみ）

features/* → shared/*（逆は不可）。features 間の直接依存は禁止（共有は shared に上げる）
AlertsLayout → features/demo/DemoDrawer（ここだけ）。DefaultLayout は参照しない

ApplicationService / CommandHandler → Logger interface のみ（FileLogger/OTelLogger を直接importしない）
EC コンテキスト → Monitoring コンテキストを直接importしない（RabbitMQ経由）

SubmitFeedbackCommandHandler → InvestigationReport.reviewStatus の更新も担う
                               （承認/却下とパターン昇格フィードバックを同一エンドポイントで処理）

InvestigateAlertOnAlertClassifiedUnknown → AIInvestigationPort インターフェースのみ依存
                                  LLMInvestigationAdapter（＋GeminiLLMClient/VertexLLMClient）/
                                  ADKAgentInvestigationAdapter を直接importしない

ForecastRiskCommandHandler（stretchⅡ）→ ForecastPort / GitHubGateway / TerraformGateway /
                                  ScheduleSource / ForecastMemoryRepository（全て read-only・write無し）
                                  既存の AnalyzeAlert / InvestigateAlert パイプラインに一切依存・干渉しない（横付けの追加レイヤー）
```

> **フロント構成の正準**: バックオフィスフロントの正準構成は `step4-4-backoffice-frontend.md`（feature-sliced・校正版）。本書（step1）のフロント節は step4-4 に合わせて feature-sliced に更新済み（要約として記載）。差分が生じた場合は実装時に **step4-4 を正**とする。

---

## テスト戦略

### ファイル配置：フラットなコロケーション

テストファイルはソースファイルと同じディレクトリに並べる（`__tests__` サブディレクトリは作らない）。

```
src/Contexts/EC/Orders/domain/
├── Order.ts
├── Order.test.ts       ← 隣に並べる
├── OrderItems.ts
└── OrderItems.test.ts
```

**理由**: リネーム・移動時にテストが一緒に動く。IDEで `Order.ts` の隣に `Order.test.ts` が表示される。Vitest のデフォルト glob がそのまま機能する。

統合テスト（MongoDB/RabbitMQ接続が必要）はサフィックスで区別し、後から `vitest.config.ts` で分離できるようにする。

```
src/Contexts/EC/Orders/infrastructure/
├── MongoOrderRepository.ts
└── MongoOrderRepository.integration.test.ts
```

---

### レイヤー別テスト方針

| ファイル種別                                             | テスト方針                                                      | 理由                                                                                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| インターフェース・型定義のみ                             | **テスト不要**                                                  | TypeScript が静的に保証。実行時ロジックがない                                                                                                                  |
| `AggregateRoot`, `ValueObject`, `DomainEvent` 基底クラス | **集約テストで間接カバー**                                      | `Order.test.ts` 等で `record()` / `equals()` が自然に通る。`FakeAggregate` を作るのはカバレッジ埋めにしかならない                                              |
| `Uuid`, `criteria/`                                      | **直接テスト**                                                  | UUID バリデーション・フィルタ組み立て等、独立した振る舞いを持つ                                                                                                |
| domain VO / Aggregate                                    | **ユースケース単位でテスト**                                    | `Order.place()` で DomainEvent 発行まで一気通貫でテストする                                                                                                    |
| application UseCase                                      | **InMemory実装 + ConsoleLogger でユニットテスト**               | `InMemoryOrderRepository` / `InMemoryInventoryRepository` / `InMemoryAsyncEventBus` / `ConsoleLogger` / `PaymentMockOrderGateway` を注入して実依存でビジネスロジックを検証。EventBus は `vi.spyOn(bus, 'publish')` で publish 内容をアサート。楽観ロックリトライ等の非同期タイマーテストは `vi.useFakeTimers()` + `vi.runAllTimersAsync()` で対処 |
| `InvestigateAlertUseCase`                                | **モック AIInvestigationPort でユニットテスト**                 | Gemini APIを差し替え。JSON返却 → InvestigationReport生成 → reviewStatus初期値の検証                                                                            |
| infrastructure Repository（MongoRepository等）           | **E2E テストで代替（統合テスト省略）**                          | ハッカソンスコープの判断。Domain + Application UT でビジネスロジックは保証済み。MongoDB・RabbitMQ の疎通は E2E（代表的なユースケースパスを数本）で確認する。環境依存の統合テストは ROI が低いため省略 |

> **E2E カバレッジ目標**: `POST /orders → GET /orders/:id` の正常系、Payment TIMEOUT シナリオ、在庫引き当て失敗による補償処理の3パスを最低限カバーする。

### テスト不要ファイル一覧（`Shared/domain`）

以下はインターフェース・型定義・抽象クラスのみのため、単体テストを書かない。

```
Command.ts / CommandBus.ts / CommandHandler.ts
Query.ts / QueryBus.ts / QueryHandler.ts
EventBus.ts / DomainEventSubscriber.ts
Logger.ts / StructuredLog.ts / AppError.ts
Nullable.ts / NewableClass.ts / Response.ts
AggregateRoot.ts    → Order.test.ts で間接カバー
ValueObject.ts      → Uuid.test.ts / criteria テストで間接カバー
DomainEvent.ts      → OrderPlacedDomainEvent.test.ts で間接カバー
```

# Step 1: ディレクトリ構成（詳細設計）

> 本ドキュメントは設計エージェント向けプロンプト v9 の Step 1 詳細設計です。
> 元資料の設計背景・制約・ハッカソン要件は元資料を参照してください。

---

## 設計判断メモ（本ドキュメント確定時の議論）

| 判断項目                                  | 決定内容                                                                                                                             | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| アプリのプロセス分割                      | `ec/backend` と `backoffice/backend` を別プロセスに分離                                                                              | 将来のスケーリング時にプロセス単位でコンテナスケールアウトできる。コンテキスト分離を構成で体現できる                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| RabbitMQ Subscriberの配置                 | 各バックエンドプロセス内に内包                                                                                                       | Subscriberは「そのイベントを使いたいコンテキストが自分で持つ」のがEDAの自然な形。中央集権化するメリット（共通処理の集約）がない                                                                                                                                                                                                                                                                                                                                                                                                                      |
| フロントエンドのディレクトリ構成          | レイヤー優先アプローチ（pages / components / hooks / infrastructure）                                                                | バックエンドのClean Architectureと対称性があり面接で説明しやすい。3画面規模に対してFeature-Sliced Designはオーバースペック                                                                                                                                                                                                                                                                                                                                                                                                                           |
| SSE通信の抽象化                           | `AlertStream` interfaceで抽象化                                                                                                      | SSEとMockの切り替えに実際の意味がある。REST APIは抽象化しない（プロトコル変更シナリオが現実的にない）                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| HTTPクライアント                          | fetchベースの薄いラッパーを自前実装（axiosを使わない）                                                                               | サプライチェーンインシデントリスク回避。標準APIで主要機能（エラーハンドリング・タイムアウト・ヘッダー）を賄える。実装はAIに委譲                                                                                                                                                                                                                                                                                                                                                                                                                      |
| HTTPクライアントの抽象化                  | `HttpClient` interfaceを定義し `FetchHttpClient` が実装                                                                              | `alertsApi.ts` 等はinterfaceに依存することでテスト時のモック差し替えが可能になる                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| デモ系コンポーネントの配置                | `components/demo/` に完全に閉じ込め、`AlertsLayout` のみで参照                                                                       | プロダクションUIへの非侵食。`AlertDetailPage` 等はデモの存在を知らない構造                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Shared/domain の value-object 設計        | CodelyTV の `value-object/` サブディレクトリをそのまま流用（`Uuid` / `StringValueObject` / `NumberValueObject` / `EnumValueObject`） | UUID バリデーション・Primitive 型制約・列挙型検証を基底クラスに集約。ECドメインの VO が `extends Uuid` / `extends NumberValueObject` 等で簡潔になる                                                                                                                                                                                                                                                                                                                                                                                                  |
| Shared/domain の CQRS 基盤追加            | `Command` / `CommandBus` / `CommandHandler` / `Query` / `QueryBus` / `QueryHandler` / `Response` を追加                              | CodelyTV 準拠。Step 3 のアプリケーション層で CommandHandler<T> を実装する際の基盤                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Logger.ts の CodelyTV 版不採用            | `Logger.ts` は独自の `StructuredLog` 設計を維持。abstract class として `write(log): Promise<void>` を強制し、`debug/info/warn/error/fatal` のコンビニエンスメソッドを提供（いずれも `write()` に委譲）。CodelyTV 版の単純文字列ログは採用しない | GCP Cloud Logging への OTel 連携で `trace_id`/`span_id` 付き構造化ログが必須。CodelyTV 版は単純すぎてこの要件を満たせない                                                                                                                                                                                                                                                                                                                                                                                                                            |
| DomainEvent.fromPrimitives シグネチャ変更 | 旧: `(aggregateId, body, eventId, occurredOn)` → 新: `{aggregateId, eventId, occurredOn, attributes}` named params                   | CodelyTV 準拠。RabbitMQ Subscriber がデシリアライズ時に呼び出すシグネチャを統一                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AIInvestigationのレポート設計             | `InvestigationReport` に `investigationSteps` / `suggestedActions` / `reviewStatus` を持たせる                                       | 「AIが調査して人間はレビューするだけ」という体験価値を実現するため。保守業務における対向先起因の障害調査を自動化するというサービスの核心。分類ツールではなく調査エージェントとして機能させる                                                                                                                                                                                                                                                                                                                                                         |
| レビューステータスの管理                  | `reviewStatus: PENDING_REVIEW / APPROVED / REJECTED` を `InvestigationReport` に持たせる                                             | 承認/却下フィードバックを既存の `SubmitFeedbackCommandHandler` に統合できる。新規コンテキスト不要                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **仮完成後の優先追加実装**                | `ElasticsearchAlertClassifier` を `AlertClassifier` Strategyの第2実装として追加する                                                  | ハッカソン本体完成後のROIが最も高い追加実装。工数約6時間。`AnalyzeAlertCommandHandler` はインターフェースにのみ依存しているため既存コードをノータッチで差し替え可能。`InMemoryAlertClassifier`（完全一致・confidence 1.0固定）に対し、BM25スコアリングによるconfidence実数値化が実現できる。面接で「将来できます」ではなく「実装済みです」として説明できる点が転職ポートフォリオとしての価値を高める。`Shared/infrastructure/persistence/elasticsearch/` に `ElasticClientFactory` / `ElasticCriteriaConverter` が既に設計済みのため追加コストが低い |

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
│   │   └── InvalidArgumentError.ts # VO構築失敗の基底エラー（errorCode: INVALID_ARGUMENT）
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
│       └── StructuredLog.ts      # ログスキーマの型定義（severity/trace_id/span_idなど）
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
        │   └── MongoRepository.ts        # Criteria対応の抽象MongoDBリポジトリ基底
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
│   │   ├── OrderId.ts                                     # Value Object
│   │   ├── OrderStatus.ts                                 # Value Object（PENDING/CONFIRMED/FAILED）
│   │   ├── OrderItems.ts                                  # Value Object（OrderItemの集合）
│   │   ├── OrderItem.ts                                   # Value Object（productId/quantity/price）
│   │   ├── CustomerId.ts                                  # Value Object
│   │   ├── TotalAmount.ts                                 # Value Object
│   │   ├── OrderRepository.ts                             # Repositoryインターフェース（Domain層）
│   │   └── events/
│   │       ├── OrderPlacedDomainEvent.ts                  # 注文確定イベント
│   │       └── InventoryReservationRequestedDomainEvent.ts # 在庫引き当て要求イベント
│   ├── application/
│   │   ├── PlaceOrder/
│   │   │   ├── PlaceOrderCommand.ts                       # 注文作成コマンド
│   │   │   └── PlaceOrderCommandHandler.ts                # コマンドハンドラ
│   │   └── GetOrder/
│   │       ├── GetOrderQuery.ts                           # 注文取得クエリ
│   │       └── GetOrderQueryHandler.ts                    # クエリハンドラ（Read側）
│   └── infrastructure/
│       ├── persistence/
│       │   └── MongoOrderRepository.ts                    # OrderRepository MongoDB実装
│       └── subscribers/
│           └── (なし。Orderは発行側のみ)
│
├── Inventory/
│   ├── domain/
│   │   ├── Inventory.ts                                   # Inventory集約ルート（AggregateRoot継承）
│   │   ├── ProductId.ts                                   # Value Object
│   │   ├── StockQuantity.ts                               # Value Object（0以下を許容しない制約）
│   │   ├── InventoryRepository.ts                         # Repositoryインターフェース（Domain層）
│   │   └── events/
│   │       ├── InventoryReservedDomainEvent.ts            # 在庫引き当て成功イベント
│   │       └── InventoryReservationFailedDomainEvent.ts   # 在庫引き当て失敗（既知障害デモの核心）
│   ├── application/
│   │   └── ReserveInventory/
│   │       ├── ReserveInventoryCommand.ts                 # 在庫引き当てコマンド
│   │       └── ReserveInventoryCommandHandler.ts          # コマンドハンドラ
│   └── infrastructure/
│       ├── persistence/
│       │   └── MongoInventoryRepository.ts                # InventoryRepository MongoDB実装
│       └── subscribers/
│           └── ReserveInventoryOnOrderPlaced.ts           # OrderPlacedを購読して引き当て実行
│
└── Payment/
    ├── domain/
    │   └── events/
    │       └── PaymentTimeoutDomainEvent.ts               # 決済タイムアウトイベント（シナリオ1の核心）
    └── infrastructure/
        └── PaymentMockService.ts                          # モック決済（success/random/timeout切り替え）
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
│   │   ├── KnownErrorPattern.ts               # 既知障害パターンエンティティ
│   │   ├── AlertRepository.ts                 # Repositoryインターフェース
│   │   └── KnownErrorPatternRepository.ts     # Repositoryインターフェース
│   ├── application/
│   │   ├── AnalyzeAlert/
│   │   │   ├── AnalyzeAlertCommand.ts
│   │   │   └── AnalyzeAlertCommandHandler.ts  # 既知/未知分類ロジック
│   │   └── SubmitFeedback/
│   │       ├── SubmitFeedbackCommand.ts
│   │       └── SubmitFeedbackCommandHandler.ts # フィードバック受付・既知昇格トリガー・レポートレビュー結果の記録
│   └── infrastructure/
│       ├── persistence/
│       │   ├── MongoAlertRepository.ts
│       │   └── MongoKnownErrorPatternRepository.ts
│       └── subscribers/
│           └── CollectMonitoringEventOnECDomainEvent.ts # ECイベント→MonitoringEvent変換（橋渡し）
│
├── AIInvestigation/
│   ├── domain/
│   │   ├── InvestigationReport.ts             # AI調査レポートエンティティ
│   │   │                                      #   summary: string           原因仮説サマリー
│   │   │                                      #   confidence: number        確信度（0.0〜1.0）
│   │   │                                      #   investigationSteps: string[]  AIが実施した調査ステップ
│   │   │                                      #   suggestedActions: string[]    推奨アクション一覧
│   │   │                                      #   suggestedPatternName: string  自動昇格候補パターン名（Geminiが提案）
│   │   │                                      #   reviewStatus: ReviewStatus    PENDING_REVIEW / APPROVED / REJECTED
│   │   │                                      #   ※ reviewStatusはSubmitFeedbackCommandHandlerで更新
│   │   ├── ReviewStatus.ts                    # Value Object（PENDING_REVIEW / APPROVED / REJECTED）
│   │   ├── InvestigationContext.ts            # Geminiへ送るコンテキストの型（トークン上限3,500）
│   │   └── AIInvestigationPort.ts             # Gemini API呼び出しのポートインターフェース（DIP）
│   ├── application/
│   │   └── InvestigateAlert/
│   │       ├── InvestigateAlertCommand.ts
│   │       └── InvestigateAlertCommandHandler.ts # 未知障害時にGeminiへ投げ、InvestigationReportを生成・保存
│   └── infrastructure/
│       └── GeminiAIInvestigationAdapter.ts    # AIInvestigationPort実装（@google/generative-ai）
│                                              # プロンプト設計：JSON固定出力（summary/confidence/investigationSteps/suggestedActions/suggestedPatternName）
│                                              # ガード：スキーマバリデーション（safeParse）・confidenceクランプ・タイムアウトリトライ1回
│
├── ReportGeneration/
│   ├── domain/
│   │   └── AlertReport.ts                     # バックオフィス表示用レポートの読み取りモデル
│   │                                          # InvestigationReportの内容をUIに渡す形に整形する責務
│   ├── application/
│   │   └── GetAlertReport/
│   │       ├── GetAlertReportQuery.ts
│   │       └── GetAlertReportQueryHandler.ts
│   └── infrastructure/
│       └── SSEAlertNotifier.ts                # 新規アラート発生時のSSEプッシュ担当
│
└── SimilarIncident/
    ├── domain/
    │   ├── SimilarIncident.ts                 # 類似インシデントエンティティ
    │   └── SimilarIncidentRepository.ts       # インターフェース（findSimilar/index）
    └── infrastructure/
        ├── InMemorySimilarIncidentRepository.ts  # 今回の実装（起動時にMongoからウォームアップ）
        └── InMemoryCriteriaConverter.ts          # Criteria→array filter/sort変換
```

### AlertClassifier Strategyパターン 拡張ロードマップ（仮完成後の優先実装）

```
AlertClassifier（インターフェース）
  ├─ InMemoryAlertClassifier        ← ハッカソン本体で実装（完全一致・confidence 1.0固定）
  └─ ElasticsearchAlertClassifier   ← 仮完成後に追加（BM25スコアリング・confidence実数値）
```

**追加ファイル（既存コードへの変更ゼロ）**

```
src/Contexts/Monitoring/AlertAnalysis/
└── infrastructure/
    └── ElasticsearchAlertClassifier.ts   # AlertClassifier実装（BM25スコア→confidenceマッピング）

src/Contexts/Shared/infrastructure/persistence/elasticsearch/
├── ElasticClientFactory.ts               # 設計済み（追加コストなし）
├── ElasticConfig.ts                      # 設計済み（追加コストなし）
└── ElasticCriteriaConverter.ts           # 設計済み（追加コストなし）
```

**実装方針メモ（面接・ADR説明用）**

- 既知パターンをElasticsearchにインデックスし、MonitoringEventのeventName/payloadをクエリとして投げる
- BM25スコアを `confidence` にマッピング（スコア正規化）
- `AnalyzeAlertCommandHandler` はインターフェースにのみ依存しているため差し替えでノータッチ
- 「将来できます」ではなく「実装済みです」として説明できる状態にすることがポートフォリオ価値の核心
- 移行トリガー：自動昇格パターンが10件超、または `/analytics` で誤分類率が計測可能になった時点

---

## `src/apps/`

### `ec/backend/`

```
src/apps/ec/backend/
├── src/
│   ├── server.ts                    # Expressサーバーエントリポイント
│   ├── App.ts                       # Express appセットアップ（ミドルウェア登録）
│   ├── routes/
│   │   └── orderRoutes.ts           # POST /orders, GET /orders/:id
│   ├── controllers/
│   │   └── OrderPostController.ts   # PlaceOrderCommandをディスパッチ
│   └── subscribers/
│       └── registerSubscribers.ts   # RabbitMQ Subscriber起動（ReserveInventoryOnOrderPlaced）
└── package.json
```

### `backoffice/backend/`

```
src/apps/backoffice/backend/
├── src/
│   ├── server.ts                    # Expressサーバーエントリポイント
│   ├── App.ts                       # Express appセットアップ
│   ├── routes/
│   │   ├── alertRoutes.ts           # GET /alerts, GET /alerts/:id, PATCH /alerts/:id/feedback
│   │   ├── patternRoutes.ts         # GET /patterns, POST /patterns/:id/promote
│   │   ├── analyticsRoutes.ts       # GET /analytics
│   │   ├── streamRoutes.ts          # GET /alerts/stream（SSEエンドポイント）
│   │   └── demoRoutes.ts            # POST /demo/** （環境変数で本番無効化）
│   ├── controllers/
│   │   ├── AlertsGetController.ts
│   │   ├── AlertGetController.ts
│   │   ├── AlertFeedbackPatchController.ts   # レポートレビュー（承認/却下）も同エンドポイントで受け付ける
│   │   ├── AlertsStreamController.ts        # SSEコネクション管理
│   │   ├── PatternsGetController.ts
│   │   ├── PatternPromotePostController.ts
│   │   ├── AnalyticsGetController.ts
│   │   └── demo/
│   │       ├── DemoPaymentModePostController.ts
│   │       ├── DemoScenarioTriggerPostController.ts
│   │       ├── DemoResetPostController.ts   # 全体リセット + シードデータ投入
│   │       └── DemoStatusGetController.ts
│   └── subscribers/
│       └── registerSubscribers.ts   # CollectMonitoringEventOnECDomainEvent 起動
└── package.json
```

### `backoffice/frontend/`

```
src/apps/backoffice/frontend/
├── src/
│   ├── main.tsx                     # Reactエントリポイント
│   ├── App.tsx                      # ルーティング定義（React Router）
│   │
│   ├── layouts/
│   │   ├── AlertsLayout.tsx         # /alerts 専用レイアウト（DemoDrawerをここだけで参照）
│   │   └── DefaultLayout.tsx        # /alerts/:id, /analytics 用（DemoDrawer非表示）
│   │
│   ├── pages/
│   │   ├── AlertsPage.tsx           # /alerts（デモのメイン舞台）
│   │   ├── AlertDetailPage.tsx      # /alerts/:id（運用想定フル詳細・デモドロワー非表示）
│   │   └── AnalyticsPage.tsx        # /analytics（AI精度トラッキング）
│   │
│   ├── components/
│   │   ├── alerts/
│   │   │   ├── AlertList.tsx        # アラート一覧
│   │   │   ├── AlertCard.tsx        # アコーディオン展開カード
│   │   │   └── AlertCardExpanded.tsx # 展開時のAI調査レポート表示
│   │   │                            #   表示内容：
│   │   │                            #     原因仮説サマリー・確信度
│   │   │                            #     調査ステップ（AIが何を調査したか）
│   │   │                            #     推奨アクション一覧
│   │   │                            #   操作：[✓ 承認] [✗ 却下] ボタン
│   │   │                            #     → PATCH /alerts/:id/feedback に reviewStatus を送信
│   │   ├── demo/                    # デモ系コンポーネントをここに完全に閉じ込める
│   │   │   ├── DemoDrawer.tsx       # デモコントロールドロワー本体（AlertsLayoutのみで参照）
│   │   │   ├── ScenarioControls.tsx # シナリオ実行ボタン群
│   │   │   ├── PaymentModeToggle.tsx # 決済モード切り替え（OK/RD/TM）
│   │   │   └── SystemStatus.tsx     # RabbitMQ接続・SSE接続数・インシデント数
│   │   └── shared/
│   │       └── SeverityBadge.tsx    # CRITICAL/WARNING/INFO バッジ
│   │
│   ├── hooks/
│   │   ├── alerts/
│   │   │   └── useAlertStream.ts    # SSE接続フック（AlertStream interfaceを利用）
│   │   └── demo/
│   │       └── useDemoControls.ts   # デモAPIへのfetchフック
│   │
│   ├── infrastructure/
│   │   └── api/
│   │       ├── HttpClient.ts            # HTTPクライアントインターフェース（プロトコル非依存）
│   │       ├── FetchHttpClient.ts       # fetch実装（baseURL・エラーハンドリング・タイムアウト）
│   │       ├── AlertStream.ts           # SSEストリームインターフェース（Mock差し替え可能）
│   │       ├── SSEAlertStream.ts        # AlertStream のSSE実装
│   │       ├── alertsApi.ts             # GET /alerts, PATCH /alerts/:id/feedback（HttpClientに依存）
│   │       ├── analyticsApi.ts          # GET /analytics（HttpClientに依存）
│   │       └── demoApi.ts               # POST /demo/**（HttpClientに依存）
│   │
│   └── types/
│       └── alert.ts                 # フロントエンド用型定義
│                                    # InvestigationReport の表示型を含む
│                                    #   investigationSteps: string[]
│                                    #   suggestedActions: string[]
│                                    #   reviewStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
│
├── index.html
├── vite.config.ts
└── package.json
```

---

## 依存関係サマリー

```
pages        → components, hooks
components   → hooks, types
hooks        → infrastructure/api（interfaceのみ参照）
infrastructure/api → types

AlertsLayout → components/demo/DemoDrawer（ここだけ）
DefaultLayout → DemoDrawerを参照しない

ApplicationService / CommandHandler → Logger interface のみ（FileLogger/OTelLogger を直接importしない）
EC コンテキスト → Monitoring コンテキストを直接importしない（RabbitMQ経由）

SubmitFeedbackCommandHandler → InvestigationReport.reviewStatus の更新も担う
                               （承認/却下とパターン昇格フィードバックを同一エンドポイントで処理）
```

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

| ファイル種別                                             | テスト方針                                    | 理由                                                                                                              |
| -------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| インターフェース・型定義のみ                             | **テスト不要**                                | TypeScript が静的に保証。実行時ロジックがない                                                                     |
| `AggregateRoot`, `ValueObject`, `DomainEvent` 基底クラス | **集約テストで間接カバー**                    | `Order.test.ts` 等で `record()` / `equals()` が自然に通る。`FakeAggregate` を作るのはカバレッジ埋めにしかならない |
| `Uuid`, `criteria/`                                      | **直接テスト**                                | UUID バリデーション・フィルタ組み立て等、独立した振る舞いを持つ                                                   |
| domain VO / Aggregate                                    | **ユースケース単位でテスト**                  | `Order.place()` で DomainEvent 発行まで一気通貫でテストする                                                       |
| application CommandHandler                               | **モックリポジトリでユニットテスト**          | EventBus / Repository を vi.fn() でモックし、Handler の分岐ロジックに集中                                         |
| `InvestigateAlertCommandHandler`                         | **モックAIInvestigationPortでユニットテスト** | Gemini APIを差し替え。JSON返却 → InvestigationReport生成 → reviewStatus初期値の検証                               |
| infrastructure Repository                                | **統合テスト**（`.integration.test.ts`）      | 実際の MongoDB に接続して `save` / `findById` を確認                                                              |

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

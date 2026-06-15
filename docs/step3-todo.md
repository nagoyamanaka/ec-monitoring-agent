Step 3 実装タスク一覧

# ~~タスク 1: PlaceOrderCommand をクラス化~~ ✅ 完了済み

`src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommand.ts` を `class extends Command` に修正済み。

# ~~タスク 2: GetOrderQuery をクラス化~~ ✅ 完了済み

`src/Contexts/EC/Orders/application/GetOrder/GetOrderQuery.ts` を `class extends Query` に修正済み。
`src/Contexts/EC/Orders/application/OrderResponse.ts` を新規作成済み。

**設計メモ**:
- CodelyTV パターンに倣い、単体型を `interface OrderResponseItem`、配列管理を `class OrderResponse implements Response` に分離
- `GetOrder` → `new OrderResponse([order])`、将来の `ListOrders` → `new OrderResponse(orders)` で共用できる
- `GetOrder/` サブディレクトリに閉じず `application/OrderResponse.ts` に配置（クエリ横断で再利用するため）

# ~~タスク 3: PaymentGateway インターフェース定義 + PaymentMockGateway 修正~~ ✅ 完了済み

**設計メモ**:
- `run()` の引数に `orderId` を含む → Orders コンテキスト固有の概念のため、interface は `Orders/domain` に置くのが正しい
- `orderId` を渡す理由: 決済の冪等性確保（同一注文の2重課金防止）とトレーサビリティ
- `PaymentMockGateway`（payment/infra）はモード管理のみの親クラス。domain への依存を持たない
- `PaymentMockOrderGateway`（orders/infra）が親を継承しつつ `PaymentGateway` interface を実装（CodelyTV の `extends MongoRepository implements XxxRepository` パターン）

**作成・修正ファイル**:
- 【新規作成】`src/Contexts/EC/Orders/domain/PaymentGateway.ts` — interface + PaymentResult 型
- 【修正】`src/Contexts/EC/Payment/infrastructure/PaymentMockGateway.ts` — mode 管理（`setMode`）のみの親クラスに整理
- 【新規作成】`src/Contexts/EC/Orders/infrastructure/PaymentMockOrderGateway.ts` — `extends PaymentMockGateway implements PaymentGateway`、run() で SUCCESS / RANDOM / TIMEOUT 実装

# ~~タスク 4: エラークラス群の定義~~ ✅ 完了済み

- 【新規作成】`src/Contexts/EC/Orders/application/errors/OrderResourceNotFoundError.ts` — `ApplicationError` 継承、`errorCode = 'ORDER_NOT_FOUND'`、constructor は `(id: string)` のみ（Orders コンテキスト固有）
- 【新規作成】`src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderFailedError.ts` — `ApplicationError` 継承、`errorCode = 'PLACE_ORDER_FAILED'`
- 【新規作成】`src/Contexts/Shared/infrastructure/errors/RepositoryError.ts` — `InfrastructureError` 継承、`errorCode = 'REPOSITORY_ERROR'`、`LogWriteError.ts` と同パターン

# ~~タスク 5: PlaceOrderCommandHandler + PlaceOrderUseCase 実装~~ ✅ 完了済み

**設計メモ**:
- Handler / UseCase 分離パターンを全ハンドラに統一（CodelyTV の `CourseCreator` パターン準拠、`UseCase` サフィックスで命名）
- `PlaceOrderCommandHandler`: VO変換のみ（OrderId / CustomerId / OrderItems）→ `PlaceOrderUseCase.run()` に委譲
- `PlaceOrderUseCase`: Payment・Order生成・save・EventPublish・Logger の全ビジネスロジックを担う
- Handler の依存は `PlaceOrderUseCase` のみ。UseCase が `OrderRepository` / `EventBus` / `PaymentGateway` / `Logger` に依存

**作成・修正ファイル**:
- 【新規作成】`src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderUseCase.ts`
- 【修正】`src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommandHandler.ts` — UseCase に委譲する薄いルーターに変更

# ~~タスク 6: GetOrderQueryHandler + GetOrderUseCase 実装~~ ✅ 完了済み

**設計メモ**:
- タスク5と同パターン。Handler は `new OrderId(query.orderId)` の VO変換のみ → `GetOrderUseCase.run(id)` に委譲
- `GetOrderUseCase`: findById → null なら warn ログ + `OrderResourceNotFoundError` throw → `new OrderResponse([order])` を返す
- `OrderResourceNotFoundError` のコンストラクタは `(resource: string, id: string)` の2引数（タスク4の実装を確認して合わせた）

**作成ファイル**:
- 【新規作成】`src/Contexts/EC/Orders/application/GetOrder/GetOrderUseCase.ts`
- 【新規作成】`src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryHandler.ts`

---

（元プロンプト）

概要: Order取得→レスポンス変換のシンプルなRead側ハンドラを、Handler/UseCase 分離パターンで実装する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
GetOrderQueryHandler と GetOrderUseCase を新規作成してください。

**設計方針（タスク5と統一）**: Handler は VO変換のみ → `GetOrderUseCase.run()` に委譲。UseCase がビジネスロジックを担う。

作成ファイル:
- src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryHandler.ts
- src/Contexts/EC/Orders/application/GetOrder/GetOrderUseCase.ts

【GetOrderQueryHandler】

依存するクラス:
- GetOrderUseCase（constructor injection）

処理フロー:
1. GetOrderQuery を受け取る
2. new OrderId(query.orderId) で VO に変換
3. await this.getOrderUseCase.run(id) を呼び、結果を返す

QueryHandler インターフェース（src/Contexts/Shared/domain/QueryHandler.ts）を implements すること。
実装メソッドは **`handle(query: GetOrderQuery): Promise<OrderResponse>`**。

`subscribedTo()` は **`GetOrderQuery` クラス自体** を返すこと。

【GetOrderUseCase】

依存するインターフェース:
- OrderRepository: src/Contexts/EC/Orders/domain/OrderRepository.ts
- Logger: src/Contexts/Shared/domain/logging/Logger.ts

依存するクラス:
- OrderId: src/Contexts/EC/Orders/domain/OrderId.ts
- OrderResponse: src/Contexts/EC/Orders/application/OrderResponse.ts（タスク2で作成済み）
- OrderResourceNotFoundError: src/Contexts/EC/Orders/application/errors/OrderResourceNotFoundError.ts（タスク4で作成済み）

メソッドシグネチャ: `async run(id: OrderId): Promise<OrderResponse>`

処理フロー:
1. OrderRepository.findById(id) を呼ぶ
   - null の場合: OrderResourceNotFoundError を throw
2. order.toPrimitives() を使って OrderResponse を構築して返す
   - createdAt / updatedAt は .toISOString() で文字列化する
   - totalAmount は items.subtotalAmount().value を使う（OrderItemsに subtotalAmount() メソッドあり）

参考ドキュメント: docs/step3-application-layer.md の「GetOrderQueryHandler」「GetOrderUseCase」セクション

# ~~タスク 7: ReserveInventoryUseCase 実装 + ReserveInventoryOnOrderPlaced リファクタ~~ ✅ 完了済み

**設計メモ**:
- `ReserveInventory` は `OrderPlacedDomainEvent` の Subscriber のみがトリガー。HTTP エンドポイントなし
- CodelyTV パターン（`CreateBackofficeCourseOnCourseCreated` 参照）に従い、**Subscriber が UseCase を直接 inject して呼ぶ**。CommandBus 経由は不要な間接層
- `ReserveInventoryCommand` と `ReserveInventoryCommandHandler` は削除（唯一の呼び出し元が Subscriber だったため不要）
- `ReserveInventoryOnOrderPlaced` のコンストラクタを `CommandBus` → `ReserveInventoryUseCase` に変更し、`on()` で `useCase.run(event.aggregateId, event.items)` を直接呼ぶ
- **既知制約**: `InventoryRepository` に `incrementStock` が存在しないため Phase2 途中失敗時の DB ロールバック不可。`InventoryReservationFailedDomainEvent` に `reservedProductIds`（成功済み商品IDリスト）を含めて publish し、補正 job が参照して在庫を戻す設計とした。Order 補償（`CompensateOrderOnInventoryFailed`）は従来通り機能する
- **失敗イベントに成功リストを追加**: `InventoryReservationFailedDomainEvent` に `reservedProductIds?: string[]` フィールドを追加（省略時は `[]`）。Phase1失敗（INSUFFICIENT_STOCK）は `reservedProductIds` 不要のため省略
- **一括 publish**: Phase3（全商品成功）の DomainEvent 発行を商品ごとの `publish` ループから `flatMap` で全イベントを集めて1回の `publish` に変更。RabbitMQEventBus 内部は逐次処理だが、呼び出し側で複数回 `publish` するとクラッシュ時に部分発行になるリスクがあるため
- **シグネチャ修正**: `Inventory.reserve()` の実際の引数は `(orderId, quantity, outcome)` でドキュメント記載の `(orderId, items)` とは異なる
- **在庫確認**: 正しくは `inventory.stock.hasEnoughStock(quantity)`（`StockQuantity` のメソッド）
- リトライ: 指数バックオフ（100ms × 2^attempt）、最大3回。リトライ前に `findByProductId` で在庫を再取得してバージョンを更新

**作成・修正・削除ファイル**:
- 【新規作成】`src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryUseCase.ts`
- 【修正】`src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryOnOrderPlaced.ts` — `CommandBus` → `ReserveInventoryUseCase` 直接呼び出しに変更
- 【削除】`src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryCommand.ts`
- 【削除】`src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryCommandHandler.ts`

---

（元プロンプト）

概要: Phase1（全商品在庫確認）→ Phase2（楽観ロック更新）→ 補償のAll-or-Nothingフローを実装する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
ReserveInventoryCommandHandler を新規作成してください。

作成ファイル:
src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryCommandHandler.ts

依存するインターフェース:

- InventoryRepository: src/Contexts/EC/Inventory/domain/InventoryRepository.ts
- EventBus: src/Contexts/Shared/domain/EventBus.ts
- Logger: src/Contexts/Shared/domain/logging/Logger.ts

依存するドメインクラス:

- Inventory: src/Contexts/EC/Inventory/domain/Inventory.ts
- ProductId: src/Contexts/EC/Inventory/domain/ProductId.ts
- InventoryReservationFailedDomainEvent: src/Contexts/EC/Inventory/domain/InventoryReservationFailedDomainEvent.ts

処理フロー（All-or-Nothing、docs/step3-application-layer.md の「ReserveInventoryCommandHandler 処理フロー」を厳守）:

【Phase 1: 全商品の在庫確認（読み取り）】

- 各 item について InventoryRepository.findByProductId(productId) を呼ぶ
- null または在庫不足の場合: InventoryReservationFailedDomainEvent(INSUFFICIENT_STOCK) を publish して return

【Phase 2: 全商品を更新（書き込み）】

- 各 inventory について InventoryRepository.reserveStock({ productId, quantity, expectedVersion }) を呼ぶ
- VERSION_CONFLICT の場合は指数バックオフで最大3回リトライ
- リトライ上限超過: 成功済み分を InventoryRepository.incrementStock でロールバック
  → InventoryReservationFailedDomainEvent(CONCURRENT_CONFLICT) を publish して return

【全商品成功】

- 各 inventory に対して inventory.reserve(orderId, items) を呼んで DomainEvent 生成
- EventBus.publish(inventory.pullDomainEvents()) で InventoryReservedDomainEvent を発行（商品ごと）
- Logger.write(INFO, 'reserve_inventory', orderId)

CommandHandler インターフェースを implements すること。
実装メソッドは **`handle(command: ReserveInventoryCommand): Promise<void>`**。

`subscribedTo()` は **`ReserveInventoryCommand` クラス自体（コンストラクタ）** を返すこと:

```typescript
subscribedTo() { return ReserveInventoryCommand; }
```

参考ドキュメント: docs/step3-application-layer.md の「ReserveInventoryCommandHandler」セクション
※ InventoryRepository の reserveStock / incrementStock メソッドのシグネチャは既存の InventoryRepository.ts を確認して合わせること

# タスク 8: CompensateOrderOnInventoryFailed Subscriber 実装

概要: 在庫引き当て失敗イベントを受けてOrderをFAILEDに補償するSubscriberを実装する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
CompensateOrderOnInventoryFailed Subscriber を新規作成してください。

作成ファイル:
src/Contexts/EC/Orders/application/CompensateOrder/CompensateOrderOnInventoryFailed.ts

依存するインターフェース:

- OrderRepository: src/Contexts/EC/Orders/domain/OrderRepository.ts
- EventBus: src/Contexts/Shared/domain/EventBus.ts
- Logger: src/Contexts/Shared/domain/logging/Logger.ts

依存するドメインクラス:

- OrderId: src/Contexts/EC/Orders/domain/OrderId.ts
- InventoryReservationFailedDomainEvent: src/Contexts/EC/Inventory/domain/InventoryReservationFailedDomainEvent.ts

キュー名（subscribedTo() の queueName として返す）:
ec-backend.ec.inventory.reservation_failed.compensate-order-on-inventory-failed

処理フロー:

1. InventoryReservationFailedDomainEvent を受け取る
2. OrderRepository.findById(orderId) を呼ぶ
   - null の場合: Logger.write(WARN) して ack（冪等性：注文未存在は無視）
3. order.status.isPending() を確認する
   - false の場合: Logger.write(WARN) して ack（既に CONFIRMED/FAILED なら無視）
4. order.failInventory() を呼ぶ（PENDING → FAILED）
5. OrderRepository.save(order) を呼ぶ
6. Logger.write(WARN, 'compensate_order', orderId → FAILED)

DomainEventSubscriber<InventoryReservationFailedDomainEvent> を implements すること。

既存の ReserveInventoryOnOrderPlaced（src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryOnOrderPlaced.ts）を参考にして実装すること。

参考ドキュメント: docs/step3-application-layer.md の「CompensateOrderOnInventoryFailed」セクション

# タスク 9: errorHandler ミドルウェア + server.ts 実装

概要: EC backend の Express サーバー起動・ルーティング・DI・RabbitMQ Subscriber 登録をまとめて実装する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
EC backend の Express サーバーをセットアップしてください。

前提:

- タスク1〜8が完了済み
- src/apps/ec/backend/src/server.ts は現在 TODO コメントのみ
- backoffice/backend/src/server.ts があれば参考にすること

【作業1】errorHandler ミドルウェアの作成
作成ファイル: src/apps/ec/backend/src/middleware/errorHandler.ts

DomainError → 400、OrderResourceNotFoundError → 404、ApplicationError → 400、InfrastructureError → 500、その他 → 500 にマッピング。
docs/step3-application-layer.md の「errorHandler でのマッピング」セクションのコードを参考にすること。

【作業2】server.ts の実装
src/apps/ec/backend/src/server.ts に以下を実装する:

- Express アプリの起動
- 以下のルーティングを登録:
  - POST /orders → PlaceOrderCommandHandler
  - GET /orders/:orderId → GetOrderQueryHandler
  - POST /demo/payment-mode → PaymentMockGateway.setMode()
- InMemoryCommandBus / InMemoryQueryBus に各ハンドラを登録
- RabbitMQ Subscriber の登録:
  - ReserveInventoryOnOrderPlaced
  - CompensateOrderOnInventoryFailed
- errorHandler を Express の error middleware として登録

DI は手動 new で構築すること（IoC コンテナは不使用）。
MongoClientFactory / RabbitMqConnection の初期化は既存の infrastructure コードを参照すること。

参考ドキュメント: docs/step3-application-layer.md 全体

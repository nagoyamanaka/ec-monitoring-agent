Step 3 実装タスク一覧

# タスク 1: PlaceOrderCommand をクラス化

概要: 現在インターフェースになっている PlaceOrderCommand を、Command を継承したクラスに変更する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
以下のファイルを修正してください。

対象ファイル:
src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommand.ts

現在の状態:

- `PlaceOrderCommand` がインターフェースとして定義されている
- `OrderItemPrimitive` を items の型として使っている

修正内容:

- `Command`（src/Contexts/Shared/domain/Command.ts）を継承したクラスに変更する
- コンストラクタで orderId: string / customerId: string / items: Array<{ productId: string; quantity: number; unitPrice: number }> を受け取る
- readonly フィールドとして定義する
- super() を呼ぶ

参考ドキュメント: docs/step3-application-layer.md の「PlaceOrderCommand」セクション

# タスク 2: GetOrderQuery をクラス化 + GetOrderQueryResponse 定義

概要: GetOrderQuery をインターフェースから Query 継承クラスへ変更し、GetOrderQueryResponse を新規作成する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
以下の作業をしてください。

【修正1】src/Contexts/EC/Orders/application/GetOrder/GetOrderQuery.ts

- 現在インターフェースになっている GetOrderQuery を、
  Query（src/Contexts/Shared/domain/Query.ts）を継承したクラスに変更する
- コンストラクタで readonly orderId: string を受け取り super() を呼ぶ

【新規作成】src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryResponse.ts

- 以下の型を定義する（VOをほどいたプリミティブ）:
- `Response`（src/Contexts/Shared/domain/Response.ts）を extends すること（`QueryHandler<Q, R extends Response>` の型制約を満たすため）

```typescript
import { Response } from "../../../../Shared/domain/Response.js";

export interface GetOrderQueryResponse extends Response {
  id: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  status: string; // 'PENDING' | 'CONFIRMED' | 'FAILED'
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

参考ドキュメント: docs/step3-application-layer.md の「GetOrder」セクション

# タスク 3: PaymentGateway インターフェース定義 + PaymentMockGateway 修正

概要: PaymentGateway インターフェースを新規作成し、PaymentMockGateway を合わせて修正する（process() → run()）。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
以下の作業をしてください。

【新規作成】src/Contexts/EC/Orders/application/PlaceOrder/PaymentGateway.ts

- 以下のインターフェースと型を定義する:

export type PaymentResult =
| { success: true; transactionId: string }
| { success: false; reason: 'TIMEOUT' | 'DECLINED' | 'ERROR' };

export interface PaymentGateway {
run(params: { orderId: string; amount: number }): Promise<PaymentResult>;
}

【修正】src/Contexts/EC/Payment/infrastructure/PaymentMockGateway.ts

- PaymentGateway インターフェースを implements する
- メソッド名を process() から run() に変更する
- 引数を { orderId: string; amount: number } に合わせる
- 成功時に transactionId: string を含める（ダミー値でOK、例: crypto.randomUUID()）
- PaymentResult 型は PaymentGateway.ts からインポートして使う
- モードは SUCCESS / RANDOM / TIMEOUT の3種類を維持する

参考ドキュメント: docs/step3-application-layer.md の「PaymentGateway」「PaymentMockGateway」セクション

# タスク 4: エラークラス群の定義

概要: ResourceNotFoundError・PlaceOrderFailedError・RepositoryError を新規作成する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
以下の3つのエラークラスを新規作成してください。

既存の基底クラス（errorCode 抽象フィールドあり）:

- ApplicationError: src/Contexts/Shared/domain/errors/ApplicationError.ts
- InfrastructureError: src/Contexts/Shared/domain/errors/InfrastructureError.ts

【新規作成1】src/Contexts/EC/Orders/application/errors/ResourceNotFoundError.ts

- ApplicationError を継承
- errorCode = 'RESOURCE_NOT_FOUND'
- constructor(resource: string, id: string) でメッセージ生成

【新規作成2】src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderFailedError.ts

- ApplicationError を継承
- errorCode = 'PLACE_ORDER_FAILED'
- constructor(orderId: string, reason: string) でメッセージ生成

【新規作成3】src/Contexts/Shared/infrastructure/errors/RepositoryError.ts
（すでに LogWriteError.ts が同じ場所にあるので同様のパターンで）

- InfrastructureError を継承
- errorCode = 'REPOSITORY_ERROR'
- constructor(operation: string, cause?: unknown) でメッセージ生成

参考ドキュメント: docs/step3-application-layer.md の「アプリケーション層のエラー定義」セクション

# タスク 5: PlaceOrderCommandHandler 実装

概要: 決済→Order生成→保存→EventBus発行の一連フローを実装する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
PlaceOrderCommandHandler を新規作成してください。

作成ファイル:
src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommandHandler.ts

依存するインターフェース（すべてドメイン抽象）:

- OrderRepository: src/Contexts/EC/Orders/domain/OrderRepository.ts
- EventBus: src/Contexts/Shared/domain/EventBus.ts
- PaymentGateway: src/Contexts/EC/Orders/application/PlaceOrder/PaymentGateway.ts
- Logger: src/Contexts/Shared/domain/logging/Logger.ts

依存するドメインクラス:

- Order: src/Contexts/EC/Orders/domain/Order.ts
- OrderId: src/Contexts/EC/Orders/domain/OrderId.ts
- CustomerId: src/Contexts/EC/Orders/domain/CustomerId.ts
- OrderItems: src/Contexts/EC/Orders/domain/OrderItems.ts
- PaymentTimeoutDomainEvent: src/Contexts/EC/Payment/domain/PaymentTimeoutDomainEvent.ts

依存するエラークラス（タスク4で作成済み）:

- PlaceOrderFailedError
- RepositoryError

処理フロー（docs/step3-application-layer.md の「PlaceOrderCommandHandler 処理フロー」を厳守）:

1. PaymentGateway.run({ orderId, amount: items合計金額 }) を呼ぶ
   - 失敗時: PaymentTimeoutDomainEvent を publish し、PlaceOrderFailedError を throw
2. OrderId / CustomerId / OrderItems を VO に変換（失敗は DomainError をそのまま throw）
3. Order.place({ id, customerId, items }) を呼ぶ
4. OrderRepository.save(order) を呼ぶ（失敗は RepositoryError を throw）
5. EventBus.publish(order.pullDomainEvents()) を呼ぶ（失敗は Logger.write(WARN)のみ）
6. Logger.write(INFO, place_order, '注文確定', orderId)

CommandHandler インターフェース（src/Contexts/Shared/domain/CommandHandler.ts）を implements すること。
実装メソッドは **`handle(command: PlaceOrderCommand): Promise<void>`**（InMemoryCommandBus が `handler.handle(command)` を呼ぶため）。

`subscribedTo()` は **`PlaceOrderCommand` クラス自体（コンストラクタ）** を返すこと:

```typescript
subscribedTo() { return PlaceOrderCommand; }
```

CommandHandlers Map は登録時に `subscribedTo()` の戻り値をキーにし、検索時に `command.constructor` で引くため、インスタンスではなくクラスを返さなければならない。

参考ドキュメント: docs/step3-application-layer.md の「PlaceOrderCommandHandler」セクション

# タスク 6: GetOrderQueryHandler 実装

概要: Order取得→レスポンス変換のシンプルなRead側ハンドラを実装する。

プロンプト:

/home/shigeyasu/Project/ec-monitoring-agent にある TypeScript DDD プロジェクトで、
GetOrderQueryHandler を新規作成してください。

作成ファイル:
src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryHandler.ts

依存するインターフェース:

- OrderRepository: src/Contexts/EC/Orders/domain/OrderRepository.ts
- Logger: src/Contexts/Shared/domain/logging/Logger.ts

依存するクラス:

- GetOrderQuery: src/Contexts/EC/Orders/application/GetOrder/GetOrderQuery.ts（タスク2で修正済み）
- GetOrderQueryResponse: src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryResponse.ts（タスク2で作成済み）
- OrderId: src/Contexts/EC/Orders/domain/OrderId.ts
- ResourceNotFoundError: src/Contexts/EC/Orders/application/errors/ResourceNotFoundError.ts（タスク4で作成済み）

処理フロー:

1. GetOrderQuery を受け取る
2. OrderRepository.findById(new OrderId(query.orderId)) を呼ぶ
   - null の場合: ResourceNotFoundError を throw
3. order.toPrimitives() を使って GetOrderQueryResponse を構築して返す
   - createdAt / updatedAt は .toISOString() で文字列化する
   - totalAmount は items の unitPrice \* quantity の合計（または Order に合計算出メソッドがあればそれを使う）

QueryHandler インターフェース（src/Contexts/Shared/domain/QueryHandler.ts）を implements すること。
実装メソッドは **`handle(query: GetOrderQuery): Promise<GetOrderQueryResponse>`**。

`subscribedTo()` は **`GetOrderQuery` クラス自体（コンストラクタ）** を返すこと:

```typescript
subscribedTo() { return GetOrderQuery; }
```

参考ドキュメント: docs/step3-application-layer.md の「GetOrderQueryHandler」セクション

# タスク 7: ReserveInventoryCommandHandler 実装

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

DomainError → 400、ResourceNotFoundError → 404、ApplicationError → 400、InfrastructureError → 500、その他 → 500 にマッピング。
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

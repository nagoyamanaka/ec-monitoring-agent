# Step 3: アプリケーション層設計（ECドメイン）

> 本ドキュメントは設計エージェント向けプロンプト v8 の Step 3 詳細設計です。
> ディレクトリ構成は `docs/step1-directory-structure.md`、ドメインモデルは `docs/step2-domain-model.md` を参照してください。

---

## 設計判断メモ（本ドキュメント確定時の議論）

| 判断項目                                                     | 決定内容                                                                                                                                | 理由                                                                                                                                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PaymentGateway` の命名                                      | `PaymentService` から `PaymentGateway` に変更                                                                                           | 外部サービスへのアウトバウンドポートであることを明示。ドメインサービス（`XxxDomainService`）との混同を避ける                                                                                       |
| ApplicationServiceのメソッド名とクラス分離                   | CommandHandler は **VO変換のみ** を担い、ビジネスロジックは **`XxxUseCase.run()`** に委譲する。CodelyTV の `CourseCreator.run()` パターン準拠。UseCase クラスは `UseCase` サフィックスで統一（`PlaceOrderUseCase` / `GetOrderUseCase`） | Handler は「CQRSバスからの薄いルーター」に徹する。VO変換後に UseCase.run(VO引数) を呼ぶ一本道だが、将来 Subscriber からも同じ UseCase を呼べる構造を最初から持つ。全ハンドラで統一することで「Handler = 薄い」という慣習が崩れない |
| エラーの基底クラス                                           | `DomainError` / `ApplicationError` / `InfrastructureError` の3基底を定義                                                                | Domain・Application層はHTTPを知らない。errorHandlerがレイヤーの意味でHTTPステータスに変換する責務を持つ                                                                                            |
| 在庫引き当て方式                                             | All-or-Nothing（B案：事前チェック＋楽観ロック＋補償）                                                                                   | 部分成功（商品Aは届くが商品Bは届かない）はユーザー混乱リスクが高い。注文はビジネスセマンティクス上All-or-Nothingが自然                                                                             |
| Inventory atomicの実現方式                                   | 2フェーズ（Phase1: 全商品在庫確認 / Phase2: 全商品更新＋楽観ロック）                                                                    | ハッカソンスコープでMongoDBのReplicaSetなし構成のためマルチドキュメントトランザクション不使用。`InventoryRepository` インターフェースは維持するため将来のPostgreSQL移行でApplication層はノータッチ |
| PaymentタイムアウトイベントとorderId                         | Payment失敗時はOrderを生成しない。`PaymentTimeoutDomainEvent` には `orderId` を含めるが、Monitoringは「注文未確定の決済障害」として扱う | OrderがDBに存在しない段階でのイベントのため、MonitoringがorderIdでOrderを引こうとしない設計にする（Step 4で対処）                                                                                  |
| `PlaceOrderCommandHandler` でのEventBus.publish() タイミング | `save()` 後に `publish()` する                                                                                                          | DBへの永続化が完了してからイベントを外部に伝播させる。saveが失敗した場合に不正なイベントを流さない                                                                                                 |
| Payment成功後のOrder保存失敗検知                             | Payment成功直後に `place_order_payment_succeeded`（INFO）を `transactionId` 付きでログ出力する。Order確定時は `place_order`（INFO）を出力する | Outbox / PAYMENT_PENDING状態はハッカソンスコープで省略。`orderId` の冪等キー設計は維持済み。Cloud Loggingで「`place_order_payment_succeeded` あり・`place_order` なし」の orderId を検出することで未消込の決済を検知できる |
| `CompensateOrderOnInventoryFailed` Subscriber の配置         | `EC/Orders/application/CompensateOrder/` に配置                                                                                         | 補償処理はOrderコンテキストの責務。InventoryコンテキストがOrderを知る逆転を避ける。依存は `OrderRepository` / `EventBus` / `Logger`（すべてドメイン抽象）のみで infrastructure 固有の依存がないため application 層に配置する |
| Subscriber のキュー命名                                      | CodelyTV準拠 `{appName}.{eventName}.{subscriberName}`                                                                                   | 規約統一                                                                                                                                                                                           |

---

## エラー基底クラス設計

### 3基底クラス

**ファイルパス**: `src/Contexts/Shared/domain/errors/DomainError.ts`

```typescript
import { AppError } from "./AppError.js";

export abstract class DomainError extends Error implements AppError {
  abstract readonly errorCode: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

**ファイルパス**: `src/Contexts/Shared/domain/errors/ApplicationError.ts`

```typescript
import { AppError } from "./AppError.js";

export abstract class ApplicationError extends Error implements AppError {
  abstract readonly errorCode: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

**ファイルパス**: `src/Contexts/Shared/domain/errors/InfrastructureError.ts`

```typescript
import { AppError } from "./AppError.js";

export abstract class InfrastructureError extends Error implements AppError {
  abstract readonly errorCode: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

### errorHandler でのマッピング

```typescript
// src/apps/ec/backend/src/middleware/errorHandler.ts
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof DomainError) {
    res.status(400).json({ type: "domain", msg: error.message });
    return;
  }
  if (error instanceof ApplicationError) {
    if (error instanceof ResourceNotFoundError) {
      res.status(404).json({ type: "not_found", msg: error.message });
      return;
    }
    res.status(400).json({ type: "application", msg: error.message });
    return;
  }
  if (error instanceof InfrastructureError) {
    res.status(500).json({ type: "infrastructure", msg: error.message });
    return;
  }
  res.status(500).json({ type: "server", msg: "Internal server error" });
}
```

**設計ポイント**: Domain・Application層はHTTPを一切知らない。「このエラーが400/404/500に対応する」という知識はerrorHandler（HTTP層）だけが持つ。

> 将来の細粒度エラー階層への拡張案は `docs/prompt-v8.md` の「エラー階層の将来設計案」を参照。

---

## Command/Query 一覧

| クラス                           | 種別           | ファイルパス                                                                               |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `PlaceOrderCommand`              | Command        | `src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommand.ts`                       |
| `PlaceOrderCommandHandler`       | CommandHandler | `src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommandHandler.ts`                |
| `PlaceOrderUseCase`              | UseCase        | `src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderUseCase.ts`                       |
| `ReserveInventoryUseCase`        | UseCase        | `src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryUseCase.ts`        |
| `CompensateOrderUseCase`         | UseCase        | `src/Contexts/EC/Orders/application/CompensateOrder/CompensateOrderUseCase.ts`             |
| `GetOrderQuery`                  | Query          | `src/Contexts/EC/Orders/application/GetOrder/GetOrderQuery.ts`                             |
| `GetOrderQueryHandler`           | QueryHandler   | `src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryHandler.ts`                      |
| `GetOrderUseCase`                | UseCase        | `src/Contexts/EC/Orders/application/GetOrder/GetOrderUseCase.ts`                           |

> **注**: `ReserveInventoryCommand` / `ReserveInventoryCommandHandler` は実装過程で削除。Subscriber が UseCase を直接呼ぶ。

> **命名規則**: UseCase クラスは `UseCase` サフィックス統一。Handler は `XxxUseCase` を constructor injection し `handle()` から `useCase.run(VO引数)` を呼ぶだけの薄いルーター。

---

## PlaceOrder

### `PlaceOrderCommand`

**ファイルパス**: `src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommand.ts`

```typescript
export class PlaceOrderCommand extends Command {
  constructor(
    readonly orderId: string,
    readonly customerId: string,
    readonly items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>,
  ) {
    super();
  }
}
```

**設計ポイント**:

- `orderId` はController層でUUIDを生成して渡す（冪等性担保。同じIDで2回投げてもupsertで安全）
- `unitPrice` をCommandに含める理由：商品マスタUI不実装のため、注文投入時にフロント（curl / Swagger UI）が価格を指定する

---

### `PlaceOrderCommandHandler`

**ファイルパス**: `src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommandHandler.ts`

Handler は薄いルーター。VO変換のみを行い `PlaceOrderUseCase.run()` に委譲する。

```typescript
export class PlaceOrderCommandHandler implements CommandHandler<PlaceOrderCommand> {
  constructor(private readonly placeOrderUseCase: PlaceOrderUseCase) {}

  subscribedTo() { return PlaceOrderCommand; }

  async handle(command: PlaceOrderCommand): Promise<void> {
    const id = new OrderId(command.orderId);
    const customerId = new CustomerId(command.customerId);
    const items = new OrderItems(command.items.map(...));
    await this.placeOrderUseCase.run({ id, customerId, items });
  }
}
```

> `subscribedTo()` がクラス自体を返すことで、`CommandHandlers` Map のキーと `command.constructor` が一致する。

#### 依存関係

| 依存                | 種別  | 理由                    |
| ------------------- | ----- | ----------------------- |
| `PlaceOrderUseCase` | class | ビジネスロジックの委譲先 |

---

### `PlaceOrderUseCase`

**ファイルパス**: `src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderUseCase.ts`

ビジネスロジック本体。将来 Subscriber から直接呼ぶ場合もここを再利用する。

#### 依存関係

| 依存              | 種別      | 理由                                        |
| ----------------- | --------- | ------------------------------------------- |
| `OrderRepository` | interface | Order永続化                                 |
| `EventBus`        | interface | DomainEvent配信                             |
| `PaymentGateway`  | interface | 決済処理（MockGateway注入）                 |
| `Logger`          | interface | 構造化ログ（GCP固有実装を直接importしない） |

#### 処理フロー

```
PlaceOrderUseCase.run({ id: OrderId, customerId: CustomerId, items: OrderItems })

1. amount = items.subtotalAmount().value
2. PaymentGateway.run({ orderId: id.value, amount }) を呼び出す
   ├─ 成功 → 3へ進む
   └─ 失敗 → PaymentTimeoutDomainEvent を EventBus.publish()
              ※ この時点でOrderはDBに存在しない。
                Monitoringは「注文未確定の決済障害」として扱う（Step 4で対処）
              → Logger.write(WARN, place_order_payment_failed)
              → PlaceOrderFailedError をthrow（errorHandlerが400を返す）
3. Order.place({ id, customerId, items }) を呼び出す
   → OrderPlacedDomainEvent が record() に積まれる
4. OrderRepository.save(order) を呼び出す
   └─ 失敗 → RepositoryError をthrow（errorHandlerが500を返す）
5. EventBus.publish(order.pullDomainEvents()) を呼び出す
   └─ 失敗 → Logger.write(WARN)（注文自体は成功扱い。RabbitMQのFailover Publisherが再試行）
6. Logger.write({ severity: 'INFO', action: 'place_order', message: '注文確定', orderId })
```

> VO変換はHandler側で完了済み。UseCase は VO を受け取りビジネスロジックに専念する。

---

### `PaymentGateway` (Interface)

**ファイルパス**: `src/Contexts/EC/Orders/domain/PaymentGateway.ts`

```typescript
export type PaymentResult =
  | { success: true; transactionId: string }
  | { success: false; reason: "TIMEOUT" | "DECLINED" | "ERROR" };

export interface PaymentGateway {
  run(params: { orderId: string; amount: number }): Promise<PaymentResult>;
}
```

---

### `PaymentMockGateway` (Infrastructure実装)

**ファイルパス**: `src/Contexts/EC/Payment/infrastructure/PaymentMockGateway.ts`

動作モードは3種類（デモコントロールAPIで切り替え）:

| モード    | 動作                                                |
| --------- | --------------------------------------------------- |
| `SUCCESS` | 常に `{ success: true }` を返す                     |
| `RANDOM`  | 80%成功・20%タイムアウト                            |
| `TIMEOUT` | 常に `{ success: false, reason: 'TIMEOUT' }` を返す |

モードはインメモリの変数で保持。`DemoPaymentModePostController` から `PaymentMockGateway.setMode(mode)` を呼び出す。

---

## ReserveInventory

> `ReserveInventoryCommand` / `ReserveInventoryCommandHandler` は実装過程で削除。
> `ReserveInventoryOnOrderPlaced` Subscriber が `ReserveInventoryUseCase` を直接 inject して呼ぶ（CodelyTV の `CreateBackofficeCourseOnCourseCreated` パターン準拠）。

### `ReserveInventoryUseCase`

**ファイルパス**: `src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryUseCase.ts`

#### 依存関係

| 依存                  | 種別      | 理由                         |
| --------------------- | --------- | ---------------------------- |
| `InventoryRepository` | interface | 在庫取得・引き当てatomic操作 |
| `EventBus`            | interface | DomainEvent配信              |
| `Logger`              | interface | 構造化ログ                   |

#### 在庫引き当て方式：All-or-Nothing（B案）

注文はビジネスセマンティクス上All-or-Nothingが自然。部分成功はユーザー混乱リスクが高いため採用しない。

#### 実装上の既知制約

`InventoryRepository` に `incrementStock` メソッドが存在しないため、Phase 2 途中での失敗時に成功済み分の DB ロールバックが不可。代わりに `InventoryReservationFailedDomainEvent` に `reservedProductIds`（成功済み商品IDリスト）を含めて publish し、補正 job が `reservedProductIds` を参照して在庫を戻す設計とする。Order 側の補償（`CompensateOrderOnInventoryFailed`）は従来通り機能する。

また `Inventory.reserve()` の実際のシグネチャは `reserve(orderId: string, quantity: number, outcome: ...)` であり、ドキュメント記載の `reserve(orderId, items)` とは異なる。

#### 処理フロー

```
ReserveInventoryUseCase.run(orderId: string, items: OrderItemPrimitive[])

【Phase 1: 全商品の在庫確認（読み取り）】

reservations = []
for each item in items:
  productId = new ProductId(item.productId)
  inventory = await InventoryRepository.findByProductId(productId)
  if inventory === null || !inventory.stock.hasEnoughStock(item.quantity):
    → InventoryReservationFailedDomainEvent(INSUFFICIENT_STOCK) を publish
    → Logger.write(WARN, 'reserve_inventory_insufficient', productId)
    → return

  reservations.push({ inventory, quantity: item.quantity })

【Phase 2: 全商品を更新（楽観ロック、最大3回リトライ）】

successRecords = []
for each { inventory, quantity } in reservations:
  currentInventory = inventory
  for attempt in 0..MAX_RETRIES-1:
    result = await InventoryRepository.reserveStock({
      productId: currentInventory.productId,
      quantity,
      expectedVersion: currentInventory.version,
    })

    if result.success:
      finalResult = result; break

    if result.reason === 'CONCURRENT_CONFLICT' && not last attempt:
      await sleep(2^attempt * 100ms)  // 指数バックオフ
      refreshed = await InventoryRepository.findByProductId(productId)
      if refreshed && refreshed.stock.hasEnoughStock(quantity):
        currentInventory = refreshed; continue

    finalResult = result; break

  if !finalResult.success:
    → InventoryReservationFailedDomainEvent(CONCURRENT_CONFLICT, reservedProductIds=成功済みIDリスト) を publish
    → Logger.write(WARN, 'reserve_inventory_rollback', orderId)
    → return  ※ DB ロールバック省略（既知制約、上記参照）

  successRecords.push({ inventory: currentInventory, quantity, outcome: finalResult })

【全商品成功 — DomainEvent 生成・一括発行】

allEvents = successRecords.flatMap({ inventory, quantity, outcome }):
  inventory.reserve(orderId, quantity, outcome)  ← InventoryReservedDomainEvent を record()
  return inventory.pullDomainEvents()
await EventBus.publish(allEvents)  ← 全商品まとめて1回のpublish（部分発行を防ぐ）

Logger.write(INFO, 'reserve_inventory', orderId)
```

#### 将来の移行戦略（設計注記）

| フェーズ                           | 実装                                          | 前提条件                                             |
| ---------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| 今回（ハッカソン）                 | B案（事前チェック＋楽観ロック＋補償）         | MongoDB単体、低競合                                  |
| 中期（競合が増えてきた）           | MongoDBトランザクション                       | ReplicaSet構成に移行                                 |
| 長期（高競合・フラッシュセール等） | PostgreSQL＋悲観ロック（`SELECT FOR UPDATE`） | ECドメインをRDBに移行。ADR Step5のトリガー条件と連動 |

`InventoryRepository` インターフェースはDomain層に固定されているため、将来の移行はApplication層をノータッチで実現できる。

---

## GetOrder（CQRS Read側）

### `GetOrderQuery`

**ファイルパス**: `src/Contexts/EC/Orders/application/GetOrder/GetOrderQuery.ts`

```typescript
export class GetOrderQuery extends Query {
  constructor(readonly orderId: string) {
    super();
  }
}
```

### `OrderResponse`

**ファイルパス**: `src/Contexts/EC/Orders/application/OrderResponse.ts`

```typescript
import { Response } from "../../../Shared/domain/Response.js";

interface OrderResponseItem {
  id: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  status: string; // 'PENDING' | 'CONFIRMED' | 'FAILED'
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export class OrderResponse implements Response {
  public readonly orders: Array<OrderResponseItem>;
  constructor(orders: Array<Order>); // toPrimitives() でマッピング
}
```

`QueryHandler<Q, R extends Response>` の型制約を満たすために `Response` を implements する。`GetOrder` / 将来の `ListOrders` で横断的に再利用できるよう `GetOrder/` サブディレクトリではなく `application/` 直下に配置。

### `GetOrderQueryHandler`

**ファイルパス**: `src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryHandler.ts`

Handler は薄いルーター。VO変換のみを行い `GetOrderUseCase.run()` に委譲する。

```typescript
export class GetOrderQueryHandler implements QueryHandler<GetOrderQuery, OrderResponse> {
  constructor(private readonly getOrderUseCase: GetOrderUseCase) {}

  subscribedTo() { return GetOrderQuery; }

  async handle(query: GetOrderQuery): Promise<OrderResponse> {
    const id = new OrderId(query.orderId);
    return this.getOrderUseCase.run(id); // OrderResponse を返す
  }
}
```

#### 依存関係

| 依存             | 種別  | 理由                    |
| ---------------- | ----- | ----------------------- |
| `GetOrderUseCase` | class | ビジネスロジックの委譲先 |

---

### `GetOrderUseCase`

**ファイルパス**: `src/Contexts/EC/Orders/application/GetOrder/GetOrderUseCase.ts`

#### 依存関係

| 依存              | 種別      | 理由               |
| ----------------- | --------- | ------------------ |
| `OrderRepository` | interface | 注文取得（Read側） |
| `Logger`          | interface | 構造化ログ         |

#### 処理フロー

```
GetOrderUseCase.run(id: OrderId): Promise<OrderResponse>

1. OrderRepository.findById(id) を呼び出す
   └─ null → OrderResourceNotFoundError をthrow（errorHandlerが404を返す）
2. order.toPrimitives() で OrderResponse を構築して返す
```

**将来の拡張ポイント**: 注文件数が増えた場合、MongoDBのprojectionで必要フィールドのみ取得するRead専用リポジトリに差し替える。

---

## Subscribers

### `ReserveInventoryOnOrderPlaced`

**ファイルパス**: `src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryOnOrderPlaced.ts`

**キュー名**（実フォーマッタ `RabbitMQQueueNameFormatter` は `{module}.{snake_case(SubscriberClassName)}` を生成。1サブスクライバ=1キューで、購読イベントは routingKey として別途 bind される）:

```
ec-backend.reserve_inventory_on_order_placed
```

`ReserveInventory` は Subscriber のみがトリガー（HTTP エンドポイントなし）のため、CommandBus を介さず `ReserveInventoryUseCase` を直接 inject して呼ぶ（CodelyTV の `CreateBackofficeCourseOnCourseCreated` パターン）。

```
1. RabbitMQからメッセージを受信する
2. OrderPlacedDomainEvent.fromPrimitives() でデシリアライズする
3. ReserveInventoryUseCase.run(event.aggregateId, event.items) を直接呼び出す
4. 成功 → ack
5. 失敗 → Logger.write(ERROR) → nack → DeadLetterキューに転送
```

---

### `CompensateOrderOnInventoryFailed`

**ファイルパス**: `src/Contexts/EC/Orders/application/CompensateOrder/CompensateOrderOnInventoryFailed.ts`

**キュー名**:

```
ec-backend.compensate_order_on_inventory_failed
```

```
1. RabbitMQからメッセージを受信する
2. InventoryReservationFailedDomainEvent.fromPrimitives() でデシリアライズする
3. OrderRepository.findById(orderId) を呼び出す
   └─ null → Logger.write(WARN) → ack（冪等性：注文未存在は無視）
4. order.status.isPending() を確認する
   └─ false → Logger.write(WARN) → ack（既にCONFIRMED/FAILEDなら無視）
5. order.failInventory() を呼び出す（PENDING → FAILED）
6. OrderRepository.save(order) を呼び出す
7. Logger.write(WARN, 'compensate_order', orderId → FAILED)
8. ack
```

補償処理はOrderコンテキストが担う（InventoryコンテキストがOrderを知らない原則を維持）。

---

### `CollectMonitoringEventOnECEventPublished`（EC → Monitoring の橋渡し）

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/application/CollectMonitoringEvent/CollectMonitoringEventOnECEventPublished.ts`

> Monitoringコンテキストに配置する（ECコンテキストがMonitoringをimportしない原則）。
> backoffice/backend プロセスが起動時に登録する。
> **検知ソース別 peer アダプタの一つ**: EC イベント（本クラス）/ Cloud Monitoring（`CloudMonitoringAlertTranslator`）/
> CI スキャン（`SecurityScanTranslator`）が同一ディレクトリに並び、いずれも `MonitoringEvent` へ正規化して
> `CollectMonitoringEventUseCase` に合流させる。共通の購読・変換骨格は `CollectMonitoringEventSubscriber` 基底に集約。

**キュー名**（1サブスクライバ=1キュー。下記3イベントを routingKey として bind）:

```
backoffice-backend.collect_monitoring_event_on_e_c_event_published
```

**購読する EC DomainEvent（`subscribedTo()`）**:

| イベント | source | severity | 備考 |
| -------- | ------ | -------- | ---- |
| `OrderPlacedDomainEvent` | `order` | `info` | 正常系。観測のみで `isAlertable()=false`（分類/調査には乗せない） |
| `InventoryReservationFailedDomainEvent` | `inventory` | （理由で決定） | 在庫障害 |
| `PaymentTimeoutDomainEvent` | `payment` | `critical` 相当 | 決済タイムアウト |

`ec.inventory.reserved`（在庫引き当て成功）は購読しない。正常系のうち `order.placed` だけは観測フレームに `info` で流すが、`CollectMonitoringEventUseCase` が `isAlertable()` で打ち切るためアラート化しない。EC 固有の型に触れるのは本クラスの `toMonitoringEvent()` だけ（観測フレーム境界）。

---

## アプリケーション層のエラー定義

| エラークラス                        | 継承元                | 発生箇所                                    | errorHandlerの応答 |
| ----------------------------------- | --------------------- | ------------------------------------------- | ------------------ |
| `OrderResourceNotFoundError`        | `ApplicationError`    | `GetOrderUseCase`（Order未存在時）          | 404                |
| `PlaceOrderFailedError`             | `ApplicationError`    | `PlaceOrderUseCase`（Payment失敗時）        | 400                |
| `RepositoryError`                   | `InfrastructureError` | 各CommandHandler（DB操作失敗時）            | 500                |
| `InvalidOrderIdError` 等            | `DomainError`         | Value Object構築失敗                        | 400                |
| `InvalidOrderStatusTransitionError` | `DomainError`         | `order.failInventory()` 等                  | 400                |

---

## ログ出力ポイント一覧

| 出力箇所                                                | severity | action                               | message                                                  |
| ------------------------------------------------------- | -------- | ------------------------------------ | -------------------------------------------------------- |
| `PlaceOrderUseCase` 決済呼び出し直前                    | INFO     | `place_order_payment_started`        | 決済開始：{orderId}, amount={amount}                     |
| `PlaceOrderUseCase` Payment成功直後                     | INFO     | `place_order_payment_succeeded`      | 決済完了：{orderId}, transactionId={transactionId}       |
| `PlaceOrderUseCase` 完了                                | INFO     | `place_order`                        | 注文確定：{orderId}                                      |
| `PlaceOrderUseCase` Payment失敗                         | WARN     | `place_order_payment_failed`         | 決済失敗：{orderId}, reason={reason}                     |
| `ReserveInventoryCommandHandler` Phase1在庫不足         | WARN     | `reserve_inventory_insufficient` | 在庫不足（Phase1）：{productId}         |
| `ReserveInventoryCommandHandler` Phase2全成功           | INFO     | `reserve_inventory`              | 在庫引き当て成功：{orderId}             |
| `ReserveInventoryCommandHandler` Phase2競合ロールバック | WARN     | `reserve_inventory_rollback`     | 楽観ロック競合・ロールバック：{orderId} |
| `CompensateOrderOnInventoryFailed`                      | WARN     | `compensate_order`               | 注文補償処理：{orderId} → FAILED        |

---

## インフラ制約の注記（e2-medium）

e2-medium（vCPU×2, RAM×4GB）でRabbitMQ・MongoDB・EC backend・backoffice backend・frontendを同居させる構成。デモ時の留意点：

- SSE接続はデモ審査員1〜2名分のみを想定。多数接続時はメモリ使用量に注意する
- RabbitMQのprefetch数は低めに設定（推奨: 1〜5）。メッセージ処理の積み上がりを防ぐ
- 本番構成ではプロセスをコンテナ分離しスケールアウト可能な設計になっている（Step 1のプロセス分割設計参照）

---

## 集約間フロー全体図（Step 2 + Step 3 統合）

```
POST /orders
  ↓ OrdersPostController
  ↓ PlaceOrderCommand

PlaceOrderCommandHandler
  ├─ PaymentGateway.run()
  │   ├─ 成功 → 続行
  │   └─ 失敗 → PaymentTimeoutDomainEvent publish（Order未存在のまま）
  │              → PlaceOrderFailedError throw → errorHandler → 400
  │
  ├─ Order.place()
  │   └─ record(OrderPlacedDomainEvent)
  │
  ├─ OrderRepository.save(order)
  └─ EventBus.publish(order.pullDomainEvents())

RabbitMQ（並列配信）
  ├─ [EC/Inventory] ReserveInventoryOnOrderPlaced
  │   └─ ReserveInventoryUseCase.run() を直接呼び出し
  │       ├─ Phase1: 全商品在庫確認（1品でも不足 → 全体Fail）
  │       └─ Phase2: 全商品更新（楽観ロック）
  │           ├─ 全成功 → InventoryReservedDomainEvent 一括 publish（全商品まとめて1回）
  │           └─ 競合 → リトライ → 上限超過
  │                      → InventoryReservationFailedDomainEvent(CONCURRENT_CONFLICT, reservedProductIds) publish
  │
  ├─ [EC/Orders] CompensateOrderOnInventoryFailed
  │   └─ order.failInventory() → OrderRepository.save()
  │
  └─ [Monitoring] CollectMonitoringEventOnECEventPublished（EC イベント→MonitoringEvent 正規化）
      └─ CollectMonitoringEventUseCase（isAlertable で打ち切り）→ AnalyzeAlert → AIInvestigation → SSE push（Step 4）
```

---

## 次のStep（Step 4）で設計すること

- `CollectMonitoringEventOnECEventPublished` の詳細（ECDomainEvent → MonitoringEvent 変換ロジック）と、Cloud Monitoring / CI スキャンの peer ingest アダプタ群
- `MonitoringEvent` の構造定義
- `AlertAnalysis` の既知/未知分類ロジックのインターフェース（`AlertClassifier`）
- `AIInvestigationPort`（Gemini API呼び出しのポート）
- フィードバックループの集約設計（`SubmitFeedbackCommandHandler` と既知パターン昇格）
- `SimilarIncidentRepository` インターフェースと `InMemoryCriteriaConverter` の設計
- SSEプッシュの連携（`SSEAlertNotifier` との接合点）
- PaymentTimeoutDomainEvent受信時のMonitoring側の扱い（orderId未存在ケースの処理方針）

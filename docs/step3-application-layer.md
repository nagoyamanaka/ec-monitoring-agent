# Step 3: アプリケーション層設計（ECドメイン）

> 本ドキュメントは設計エージェント向けプロンプト v8 の Step 3 詳細設計です。
> ディレクトリ構成は `docs/step1-directory-structure.md`、ドメインモデルは `docs/step2-domain-model.md` を参照してください。

---

## 設計判断メモ（本ドキュメント確定時の議論）

| 判断項目                                                     | 決定内容                                                                                                                                | 理由                                                                                                                                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PaymentGateway` の命名                                      | `PaymentService` から `PaymentGateway` に変更                                                                                           | 外部サービスへのアウトバウンドポートであることを明示。ドメインサービス（`XxxDomainService`）との混同を避ける                                                                                       |
| ApplicationServiceのメソッド名                               | `process()` ではなく `run()` を採用                                                                                                     | CodelyTV準拠（`CoursesByCriteriaSearcher.run()` 等で統一されている）                                                                                                                               |
| エラーの基底クラス                                           | `DomainError` / `ApplicationError` / `InfrastructureError` の3基底を定義                                                                | Domain・Application層はHTTPを知らない。errorHandlerがレイヤーの意味でHTTPステータスに変換する責務を持つ                                                                                            |
| 在庫引き当て方式                                             | All-or-Nothing（B案：事前チェック＋楽観ロック＋補償）                                                                                   | 部分成功（商品Aは届くが商品Bは届かない）はユーザー混乱リスクが高い。注文はビジネスセマンティクス上All-or-Nothingが自然                                                                             |
| Inventory atomicの実現方式                                   | 2フェーズ（Phase1: 全商品在庫確認 / Phase2: 全商品更新＋楽観ロック）                                                                    | ハッカソンスコープでMongoDBのReplicaSetなし構成のためマルチドキュメントトランザクション不使用。`InventoryRepository` インターフェースは維持するため将来のPostgreSQL移行でApplication層はノータッチ |
| PaymentタイムアウトイベントとorderId                         | Payment失敗時はOrderを生成しない。`PaymentTimeoutDomainEvent` には `orderId` を含めるが、Monitoringは「注文未確定の決済障害」として扱う | OrderがDBに存在しない段階でのイベントのため、MonitoringがorderIdでOrderを引こうとしない設計にする（Step 4で対処）                                                                                  |
| `PlaceOrderCommandHandler` でのEventBus.publish() タイミング | `save()` 後に `publish()` する                                                                                                          | DBへの永続化が完了してからイベントを外部に伝播させる。saveが失敗した場合に不正なイベントを流さない                                                                                                 |
| `CompensateOrderOnInventoryFailed` Subscriber の配置         | `EC/Orders/application/CompensateOrder/` に配置                                                                                         | 補償処理はOrderコンテキストの責務。InventoryコンテキストがOrderを知る逆転を避ける。依存は `OrderRepository` / `EventBus` / `Logger`（すべてドメイン抽象）のみで infrastructure 固有の依存がないため application 層に配置する |
| Subscriber のキュー命名                                      | CodelyTV準拠 `{appName}.{eventName}.{subscriberName}`                                                                                   | 規約統一                                                                                                                                                                                           |

---

## エラー基底クラス設計

### 3基底クラス

**ファイルパス**: `src/Contexts/Shared/domain/DomainError.ts`

```typescript
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

**ファイルパス**: `src/Contexts/Shared/application/ApplicationError.ts`

```typescript
export abstract class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

**ファイルパス**: `src/Contexts/Shared/infrastructure/InfrastructureError.ts`

```typescript
export abstract class InfrastructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
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
| `ReserveInventoryCommand`        | Command        | `src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryCommand.ts`        |
| `ReserveInventoryCommandHandler` | CommandHandler | `src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryCommandHandler.ts` |
| `GetOrderQuery`                  | Query          | `src/Contexts/EC/Orders/application/GetOrder/GetOrderQuery.ts`                             |
| `GetOrderQueryHandler`           | QueryHandler   | `src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryHandler.ts`                      |

---

## PlaceOrder

### `PlaceOrderCommand`

**ファイルパス**: `src/Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommand.ts`

```typescript
class PlaceOrderCommand extends Command {
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

#### 依存関係

| 依存              | 種別      | 理由                                        |
| ----------------- | --------- | ------------------------------------------- |
| `OrderRepository` | interface | Order永続化                                 |
| `EventBus`        | interface | DomainEvent配信                             |
| `PaymentGateway`  | interface | 決済処理（MockGateway注入）                 |
| `Logger`          | interface | 構造化ログ（GCP固有実装を直接importしない） |

#### 処理フロー

```
1. PlaceOrderCommand を受け取る
2. PaymentGateway.run({ orderId, amount }) を呼び出す
   ├─ 成功 → 3へ進む
   └─ 失敗 → PaymentTimeoutDomainEvent を EventBus.publish()
              ※ この時点でOrderはDBに存在しない。
                Monitoringは「注文未確定の決済障害」として扱う（Step 4で対処）
              → PlaceOrderFailedError をthrow（errorHandlerが400を返す）
3. OrderId / CustomerId / OrderItems を Value Object に変換する
   └─ 構築失敗（DomainError）→ そのままthrow（errorHandlerが400を返す）
4. Order.place({ id, customerId, items }) を呼び出す
   → OrderPlacedDomainEvent が record() に積まれる
5. OrderRepository.save(order) を呼び出す
   └─ 失敗 → RepositoryError をthrow（errorHandlerが500を返す）
6. EventBus.publish(order.pullDomainEvents()) を呼び出す
   └─ 失敗 → Logger.write(WARN)（注文自体は成功扱い。RabbitMQのFailover Publisherが再試行）
7. Logger.write({ severity: 'INFO', action: 'place_order', message: '注文確定', orderId })
```

---

### `PaymentGateway` (Interface)

**ファイルパス**: `src/Contexts/EC/Orders/application/PlaceOrder/PaymentGateway.ts`

```typescript
interface PaymentGateway {
  run(params: { orderId: string; amount: number }): Promise<PaymentResult>;
}

type PaymentResult =
  | { success: true; transactionId: string }
  | { success: false; reason: "TIMEOUT" | "DECLINED" | "ERROR" };
```

---

### `PaymentMockGateway` (Infrastructure実装)

**ファイルパス**: `src/Contexts/EC/Payment/infrastructure/PaymentMockGateway.ts`

動作モードは3種類（デモコントロールAPIで切り替え）:

| モード    | 動作                                                |
| --------- | --------------------------------------------------- |
| `success` | 常に `{ success: true }` を返す                     |
| `random`  | 80%成功・20%タイムアウト                            |
| `timeout` | 常に `{ success: false, reason: 'TIMEOUT' }` を返す |

モードはインメモリの変数で保持。`DemoPaymentModePostController` から `PaymentMockGateway.setMode(mode)` を呼び出す。

---

## ReserveInventory

### `ReserveInventoryCommand`

**ファイルパス**: `src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryCommand.ts`

```typescript
class ReserveInventoryCommand extends Command {
  constructor(
    readonly orderId: string,
    readonly items: OrderItemPrimitive[],
  ) {
    super();
  }
}
```

このCommandはSubscriberから発行される（`OrderPlacedDomainEvent` を変換）。Controllerから直接呼ばれない。

---

### `ReserveInventoryCommandHandler`

**ファイルパス**: `src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryCommandHandler.ts`

#### 依存関係

| 依存                  | 種別      | 理由                         |
| --------------------- | --------- | ---------------------------- |
| `InventoryRepository` | interface | 在庫取得・引き当てatomic操作 |
| `EventBus`            | interface | DomainEvent配信              |
| `Logger`              | interface | 構造化ログ                   |

#### 在庫引き当て方式：All-or-Nothing（B案）

注文はビジネスセマンティクス上All-or-Nothingが自然。部分成功はユーザー混乱リスクが高いため採用しない。

#### 処理フロー

```
【Phase 1: 全商品の在庫確認（読み取り）】

inventories = []
for each item in command.items:
  inventory = await InventoryRepository.findByProductId(productId)
  if inventory === null || !inventory.hasEnoughStock(item.quantity):
    → 全体をFail（INSUFFICIENT_STOCK）
    → InventoryReservationFailedDomainEvent を EventBus.publish()
    → Logger.write(WARN, 'reserve_inventory_insufficient')
    → return

  inventories.push({ inventory, quantity: item.quantity })

【Phase 2: 全商品を更新（書き込み）】

succeededReservations = []
for each { inventory, quantity } in inventories:
  result = await InventoryRepository.reserveStock({
    productId,
    quantity,
    expectedVersion: inventory.version,
  })

  if result.success:
    succeededReservations.push({ productId, remainingStock: result.remainingStock })
    continue

  if result.reason === 'VERSION_CONFLICT':
    リトライ（最大3回、指数バックオフ）
    リトライ上限超過:
      → 成功済み分をロールバック（InventoryRepository.incrementStock で在庫を戻す）
      → InventoryReservationFailedDomainEvent(CONCURRENT_CONFLICT) を EventBus.publish()
      → Logger.write(WARN, 'reserve_inventory_rollback')
      → return

【全商品成功】
for each { inventory } in inventories:
  inventory.reserve(orderId, items)   ← DomainEvent生成のみ
  EventBus.publish(inventory.pullDomainEvents())
  → InventoryReservedDomainEvent を発行（商品ごと）

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
class GetOrderQuery extends Query {
  constructor(readonly orderId: string) {
    super();
  }
}
```

### `GetOrderQueryResponse`

**ファイルパス**: `src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryResponse.ts`

```typescript
interface GetOrderQueryResponse {
  id: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  status: string; // 'PENDING' | 'CONFIRMED' | 'FAILED'
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

VOをほどいたピュアなデータ構造。Controllerがそのままレスポンスとして返せる形にする。

### `GetOrderQueryHandler`

**ファイルパス**: `src/Contexts/EC/Orders/application/GetOrder/GetOrderQueryHandler.ts`

#### 依存関係

| 依存              | 種別      | 理由               |
| ----------------- | --------- | ------------------ |
| `OrderRepository` | interface | 注文取得（Read側） |
| `Logger`          | interface | 構造化ログ         |

#### 処理フロー

```
1. GetOrderQuery を受け取る
2. OrderRepository.findById(new OrderId(query.orderId)) を呼び出す
   └─ null → ResourceNotFoundError をthrow（errorHandlerが404を返す）
3. order.toPrimitives() で GetOrderQueryResponse を構築して返す
```

**将来の拡張ポイント**: 注文件数が増えた場合、MongoDBのprojectionで必要フィールドのみ取得するRead専用リポジトリに差し替える。

---

## Subscribers

### `ReserveInventoryOnOrderPlaced`

**ファイルパス**: `src/Contexts/EC/Inventory/application/ReserveInventory/ReserveInventoryOnOrderPlaced.ts`

**キュー名**:

```
ec-backend.ec.order.placed.reserve-inventory-on-order-placed
```

```
1. RabbitMQからメッセージを受信する
2. OrderPlacedDomainEvent.fromPrimitives() でデシリアライズする
3. ReserveInventoryCommand を構築する
4. ReserveInventoryCommandHandler.handle(command) を呼び出す
5. 成功 → ack
6. 失敗 → Logger.write(ERROR) → nack → DeadLetterキューに転送
```

---

### `CompensateOrderOnInventoryFailed`

**ファイルパス**: `src/Contexts/EC/Orders/application/CompensateOrder/CompensateOrderOnInventoryFailed.ts`

**キュー名**:

```
ec-backend.ec.inventory.reservation_failed.compensate-order-on-inventory-failed
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

### `CollectMonitoringEventOnECDomainEvent`（EC → Monitoring の橋渡し）

**ファイルパス**: `src/Contexts/Monitoring/AlertAnalysis/infrastructure/subscribers/CollectMonitoringEventOnECDomainEvent.ts`

> Monitoringコンテキストに配置する（ECコンテキストがMonitoringをimportしない原則）。
> backoffice/backend プロセスが起動時に登録する。

**購読するキュー（障害系イベントに絞る）**:

```
backoffice-backend.ec.order.placed.collect-monitoring-event
backoffice-backend.ec.inventory.reservation_failed.collect-monitoring-event
backoffice-backend.ec.payment.timeout.collect-monitoring-event
```

`ec.inventory.reserved`（正常系）は購読しない。障害検知に必要なイベントのみに絞りMonitoringのノイズを抑える。正常系の観測はCloud Loggingのメトリクスで対応する。

処理の詳細はStep 4で設計する。

---

## アプリケーション層のエラー定義

| エラークラス                        | 継承元                | 発生箇所                                    | errorHandlerの応答 |
| ----------------------------------- | --------------------- | ------------------------------------------- | ------------------ |
| `ResourceNotFoundError`             | `ApplicationError`    | `GetOrderQueryHandler`（Order未存在時）     | 404                |
| `PlaceOrderFailedError`             | `ApplicationError`    | `PlaceOrderCommandHandler`（Payment失敗時） | 400                |
| `RepositoryError`                   | `InfrastructureError` | 各CommandHandler（DB操作失敗時）            | 500                |
| `InvalidOrderIdError` 等            | `DomainError`         | Value Object構築失敗                        | 400                |
| `InvalidOrderStatusTransitionError` | `DomainError`         | `order.failInventory()` 等                  | 400                |

---

## ログ出力ポイント一覧

| 出力箇所                                                | severity | action                           | message                                 |
| ------------------------------------------------------- | -------- | -------------------------------- | --------------------------------------- |
| `PlaceOrderCommandHandler` 完了                         | INFO     | `place_order`                    | 注文確定：{orderId}                     |
| `PlaceOrderCommandHandler` Payment失敗                  | WARN     | `place_order_payment_failed`     | 決済失敗：{orderId}, reason={reason}    |
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
  ↓ OrderPostController
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
  │   └─ ReserveInventoryCommandHandler
  │       ├─ Phase1: 全商品在庫確認（1品でも不足 → 全体Fail）
  │       └─ Phase2: 全商品更新（楽観ロック）
  │           ├─ 全成功 → InventoryReservedDomainEvent publish（商品ごと）
  │           └─ 競合 → リトライ → 上限超過 → 成功分をロールバック
  │                      → InventoryReservationFailedDomainEvent(CONCURRENT_CONFLICT) publish
  │
  ├─ [EC/Orders] CompensateOrderOnInventoryFailed
  │   └─ order.failInventory() → OrderRepository.save()
  │
  └─ [Monitoring] CollectMonitoringEventOnECDomainEvent（障害系ECイベント購読）
      └─ Step 4へ（AlertAnalysis → AIInvestigation → SSE push）
```

---

## 次のStep（Step 4）で設計すること

- `CollectMonitoringEventOnECDomainEvent` の詳細（ECDomainEvent → MonitoringEvent 変換ロジック）
- `MonitoringEvent` の構造定義
- `AlertAnalysis` の既知/未知分類ロジックのインターフェース（`AlertClassifier`）
- `AIInvestigationPort`（Gemini API呼び出しのポート）
- フィードバックループの集約設計（`SubmitFeedbackCommandHandler` と既知パターン昇格）
- `SimilarIncidentRepository` インターフェースと `InMemoryCriteriaConverter` の設計
- SSEプッシュの連携（`SSEAlertNotifier` との接合点）
- PaymentTimeoutDomainEvent受信時のMonitoring側の扱い（orderId未存在ケースの処理方針）

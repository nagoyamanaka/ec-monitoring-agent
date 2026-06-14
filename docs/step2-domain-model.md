# Step 2: ドメインモデル設計（ECドメイン）

> 本ドキュメントは設計エージェント向けプロンプト v6 の Step 2 詳細設計です。
> Step 1のディレクトリ構成は `docs/step1-directory-structure.md` を参照してください。

---

## 設計判断メモ（本ドキュメント確定時の議論）

| 判断項目                                              | 決定内容                                                                         | 理由                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| OrderStatusの遷移制約                                 | `place()` / `confirmInventory()` / `failInventory()` の3メソッドで遷移を管理     | Aggregateが自身のState遷移を責務として持つ。不正遷移（例: FAILEDからCONFIRMED）はドメイン例外でガード                |
| `TotalAmount` の計算責務                              | `OrderItems.totalAmount()` で算出し、`Order.place()` 時に渡す                    | Value Objectの純粋性を保つ。CommandHandlerが計算するのではなく、Orderコンテキストで完結させる                        |
| `StockQuantity` の下限制約                            | Value Object内で `value >= 0` をガード                                           | 0以下の在庫という概念をドメインで禁止する。引き当て可否の判断は `hasEnoughStock()` で表現                            |
| Inventory楽観ロック                                   | `version` フィールドをAggregateに持たせ、MongoDBの `findOneAndUpdate` で競合検出 | アプリケーション層でのオプティミスティックロック実装の基盤。ACIDなしでの整合性担保                                   |
| `OrderItem.price` の型                                | `number`（プリミティブ）をOrderItemのValue Objectが保持                          | 今回の規模では価格専用VOは過剰。ただし `Money` VOへの将来移行を妨げない構造にする                                    |
| DomainEventのprimitivesの型                           | `Record<string, unknown>` を使用                                                 | CodelyTVパターン準拠                                                                                                 |

---

## Order集約

### CodelyTVパターン参照

| 本プロジェクトの要素                         | CodelyTV参照元                                            |
| -------------------------------------------- | --------------------------------------------------------- |
| `Order extends AggregateRoot`                | `Contexts/Shared/domain/AggregateRoot.ts`                 |
| `OrderPlacedDomainEvent extends DomainEvent` | `Contexts/Mooc/Shared/domain/DomainEvent.ts` パターン     |
| `OrderRepository` interface                  | `Contexts/Mooc/Shared/domain/courses/CourseRepository.ts` |
| Value Object基底                             | `Contexts/Shared/domain/ValueObject.ts`                   |

---

### `Order` (AggregateRoot)

**ファイルパス**: `src/Contexts/EC/Orders/domain/Order.ts`

#### プロパティ

| プロパティ    | 型            | 説明                                           |
| ------------- | ------------- | ---------------------------------------------- |
| `id`          | `OrderId`     | 集約識別子                                     |
| `customerId`  | `CustomerId`  | 注文者ID                                       |
| `items`       | `OrderItems`  | 注文明細の集合                                 |
| `totalAmount` | `TotalAmount` | 合計金額                                       |
| `status`      | `OrderStatus` | 注文ステータス（PENDING / CONFIRMED / FAILED） |
| `createdAt`   | `Date`        | 注文日時                                       |
| `updatedAt`   | `Date`        | 最終更新日時                                   |

#### ファクトリメソッド

```typescript
static place(params: {
  id: OrderId;
  customerId: CustomerId;
  items: OrderItems;
}): Order
```

- `OrderStatus` を `PENDING` で初期化する
- `totalAmount` は `items.totalAmount()` から算出する
- `OrderPlacedDomainEvent` を `record()` に積む
- インスタンスを返す（`new Order()` は外部から直接呼ばせない）

#### 状態遷移メソッド

```typescript
confirmInventory(): void
```

- 事前条件: `status === PENDING`（違反時は `InvalidOrderStatusTransitionError` をthrow）
- `status` を `CONFIRMED` に更新する
- `updatedAt` を現在日時に更新する

```typescript
failInventory(): void
```

- 事前条件: `status === PENDING`（違反時は `InvalidOrderStatusTransitionError` をthrow）
- `status` を `FAILED` に更新する
- `updatedAt` を現在日時に更新する

#### 永続化用メソッド（CodelyTVパターン準拠）

```typescript
static fromPrimitives(params: {
  id: string;
  customerId: string;
  items: OrderItemPrimitive[];
  totalAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Order
```

```typescript
toPrimitives(): {
  id: string;
  customerId: string;
  items: OrderItemPrimitive[];
  totalAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 発行するDomainEvent一覧

| イベント                                   | 発行タイミング       | 受け取るコンテキスト             |
| ------------------------------------------ | -------------------- | -------------------------------- |
| `OrderPlacedDomainEvent` | `place()` 呼び出し時 | Monitoring（観測用）/ EC/Inventory（在庫引き当て実行） |

---

### Value Objects（Orders）

#### `OrderId`

**ファイルパス**: `src/Contexts/EC/Orders/domain/OrderId.ts`

```typescript
class OrderId extends ValueObject<string> {
  constructor(value: string); // UUID v4形式を期待。空文字はInvalidOrderIdErrorをthrow
}
```

#### `CustomerId`

**ファイルパス**: `src/Contexts/EC/Orders/domain/CustomerId.ts`

```typescript
class CustomerId extends ValueObject<string> {
  constructor(value: string); // UUID v4形式を期待
}
```

#### `OrderStatus`

**ファイルパス**: `src/Contexts/EC/Orders/domain/OrderStatus.ts`

```typescript
const OrderStatusValues = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
} as const;

type OrderStatusValue =
  (typeof OrderStatusValues)[keyof typeof OrderStatusValues];

class OrderStatus extends ValueObject<OrderStatusValue> {
  static pending(): OrderStatus;
  static confirmed(): OrderStatus;
  static failed(): OrderStatus;
  isPending(): boolean;
  isConfirmed(): boolean;
  isFailed(): boolean;
}
```

#### `OrderItem`

**ファイルパス**: `src/Contexts/EC/Orders/domain/OrderItem.ts`

```typescript
// プリミティブ型（シリアライズ用）
interface OrderItemPrimitive {
  productId: string;
  quantity: number;
  unitPrice: number;
}

class OrderItem {
  constructor(
    readonly productId: string,    // 将来ProductId VOへの移行ポイント
    readonly quantity: number,     // 1以上。違反時はInvalidOrderItemError
    readonly unitPrice: number,    // 0以上。将来Money VOへの移行ポイント
  )
  subtotal(): number               // quantity * unitPrice
  toPrimitives(): OrderItemPrimitive
  static fromPrimitives(p: OrderItemPrimitive): OrderItem
}
```

#### `OrderItems`

**ファイルパス**: `src/Contexts/EC/Orders/domain/OrderItems.ts`

```typescript
class OrderItems extends ValueObject<OrderItem[]> {
  constructor(value: OrderItem[]); // 空配列はEmptyOrderItemsErrorをthrow
  totalAmount(): TotalAmount; // 全OrderItemのsubtotal()合計
  toPrimitives(): OrderItemPrimitive[];
  static fromPrimitives(p: OrderItemPrimitive[]): OrderItems;
}
```

#### `TotalAmount`

**ファイルパス**: `src/Contexts/EC/Orders/domain/TotalAmount.ts`

```typescript
class TotalAmount extends ValueObject<number> {
  constructor(value: number); // 0以上。違反時はInvalidTotalAmountError
}
```

---

### DomainEvents（Orders）

#### `OrderPlacedDomainEvent`

**ファイルパス**: `src/Contexts/EC/Orders/domain/events/OrderPlacedDomainEvent.ts`

```typescript
class OrderPlacedDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = 'ec.order.placed';

  readonly customerId: string;
  readonly items: OrderItemPrimitive[];
  readonly totalAmount: number;

  constructor(params: {
    orderId: string;
    customerId: string;
    items: OrderItemPrimitive[];
    totalAmount: number;
    eventId?: string;
    occurredOn?: Date;
  })

  toPrimitives(): Record<string, unknown>

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): OrderPlacedDomainEvent
}
```

**設計ポイント**: `aggregateId` は `orderId` と同義。RabbitMQのRoutingKey: `ec.order.placed`

---

### `OrderRepository` (Interface)

**ファイルパス**: `src/Contexts/EC/Orders/domain/OrderRepository.ts`

```typescript
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCriteria(criteria: Criteria): Promise<Order[]>;
}
```

**設計ポイント**:

- `save()` はinsertとupdateを兼ねる（upsert）
- `findByCriteria()` は将来の注文検索に備えた拡張ポイント。今回のユースケースでは `findById` のみ使用
- MongoDB実装: `MongoOrderRepository` は `Infrastructure` 層に配置

---

## Inventory集約

### CodelyTVパターン参照

| 本プロジェクトの要素                | CodelyTV参照元                                            |
| ----------------------------------- | --------------------------------------------------------- |
| `Inventory extends AggregateRoot`   | `Contexts/Shared/domain/AggregateRoot.ts`                 |
| `InventoryRepository` interface     | `Contexts/Mooc/Shared/domain/courses/CourseRepository.ts` |
| `StockQuantity extends ValueObject` | `Contexts/Shared/domain/ValueObject.ts`                   |

---

### `Inventory` (AggregateRoot)

**ファイルパス**: `src/Contexts/EC/Inventory/domain/Inventory.ts`

#### プロパティ

| プロパティ  | 型              | 説明                               |
| ----------- | --------------- | ---------------------------------- |
| `productId` | `ProductId`     | 集約識別子（商品単位で在庫を管理） |
| `stock`     | `StockQuantity` | 現在の在庫数                       |
| `version`   | `number`        | 楽観的ロック用バージョン番号       |
| `updatedAt` | `Date`          | 最終更新日時                       |

#### ファクトリメソッド

```typescript
static initialize(params: {
  productId: ProductId;
  initialStock: StockQuantity;
}): Inventory
```

- 初期在庫を設定してInventoryを生成する
- `version` は `0` から開始する

#### ビジネスロジックメソッド

```typescript
reserve(orderId: string, items: OrderItemPrimitive[]): void
```

- `items` から自商品分の `quantity` を合算する
- `stock.hasEnoughStock(quantity)` で在庫確認する
- 在庫あり: `stock` をデクリメントし `InventoryReservedDomainEvent` を `record()` に積む
- 在庫なし: `InventoryReservationFailedDomainEvent` を `record()` に積む（在庫切れはビジネスエラーとしてイベントで表現する。例外はthrowしない）
- どちらのケースでも例外をthrowしない（イベントで表現する）

**設計ポイント**: `reserve()` はatomicな操作を表現するが、実際のatomic保証はMongoDB層の `findOneAndUpdate` が担う。`reserve()` はDomainEventの生成責務を持ち、Infrastructure層が実際の競合検出を行う。

#### 永続化用メソッド

```typescript
static fromPrimitives(params: {
  productId: string;
  stock: number;
  version: number;
  updatedAt: Date;
}): Inventory
```

```typescript
toPrimitives(): {
  productId: string;
  stock: number;
  version: number;
  updatedAt: Date;
}
```

#### 発行するDomainEvent一覧

| イベント                                | 発行タイミング                   | 受け取るコンテキスト                         |
| --------------------------------------- | -------------------------------- | -------------------------------------------- |
| `InventoryReservedDomainEvent`          | `reserve()` で在庫引き当て成功時 | Monitoring（観測用）                         |
| `InventoryReservationFailedDomainEvent` | `reserve()` で在庫不足時         | Monitoring（在庫切れビジネスエラーの観測用） |

---

### Value Objects（Inventory）

#### `ProductId`

**ファイルパス**: `src/Contexts/EC/Inventory/domain/ProductId.ts`

```typescript
class ProductId extends ValueObject<string> {
  constructor(value: string); // UUID v4形式を期待。空文字はInvalidProductIdErrorをthrow
}
```

#### `StockQuantity`

**ファイルパス**: `src/Contexts/EC/Inventory/domain/StockQuantity.ts`

```typescript
class StockQuantity extends ValueObject<number> {
  constructor(value: number); // 0以上のみ許可。違反時はInvalidStockQuantityError
  hasEnoughStock(quantity: number): boolean;
  decrement(quantity: number): StockQuantity; // 結果が0未満になる場合はInvalidStockQuantityError
  increment(quantity: number): StockQuantity; // 将来の返品フロー用
}
```

**設計ポイント**: `0` は許容する（在庫切れ状態を表す）。マイナスは許容しない。

---

### DomainEvents（Inventory）

#### `InventoryReservedDomainEvent`

**ファイルパス**: `src/Contexts/EC/Inventory/domain/events/InventoryReservedDomainEvent.ts`

```typescript
class InventoryReservedDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = 'ec.inventory.reserved';

  readonly orderId: string;
  readonly reservedQuantity: number;
  readonly remainingStock: number;

  constructor(params: {
    productId: string;
    orderId: string;
    reservedQuantity: number;
    remainingStock: number;
    eventId?: string;
    occurredOn?: Date;
  })

  toPrimitives(): Record<string, unknown>

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): InventoryReservedDomainEvent
}
```

**設計ポイント**: `aggregateId` は `productId`。`remainingStock` を含めることでMonitoringが在庫推移をトレースできる。

#### `InventoryReservationFailedDomainEvent`

**ファイルパス**: `src/Contexts/EC/Inventory/domain/events/InventoryReservationFailedDomainEvent.ts`

```typescript
// 失敗理由の列挙（Monitoringの既知パターン照合に使用）
export const InventoryFailureReason = {
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  CONCURRENT_CONFLICT: 'CONCURRENT_CONFLICT', // 楽観ロック競合（MongoDBリトライ上限超過）
} as const;

export type InventoryFailureReasonValue =
  (typeof InventoryFailureReason)[keyof typeof InventoryFailureReason];

class InventoryReservationFailedDomainEvent extends ECDomainEvent {
  static readonly EVENT_NAME = 'ec.inventory.reservation_failed';

  readonly orderId: string;
  readonly requestedQuantity: number;
  readonly currentStock: number;  // 不足していた在庫数（Monitoring分析に使用）
  readonly reason: InventoryFailureReasonValue;

  constructor(params: {
    productId: string;
    orderId: string;
    requestedQuantity: number;
    currentStock: number;
    reason: InventoryFailureReasonValue;
    eventId?: string;
    occurredOn?: Date;
  })

  toPrimitives(): Record<string, unknown>

  static fromPrimitives(params: {
    aggregateId: string;
    eventId: string;
    occurredOn: Date;
    attributes: Record<string, unknown>;
  }): InventoryReservationFailedDomainEvent
}
```

**設計ポイント**: `reason` と `currentStock` をprimitivesに含めることで、Monitoringが「在庫切れ（INSUFFICIENT_STOCK）」「楽観ロック競合（CONCURRENT_CONFLICT）」を区別して観測できる。在庫切れは結果整合性モデルにおけるビジネスエラーとして扱い、注文ステータスをFAILEDに遷移させる補償処理のトリガーとなる（Step 3で設計）。

---

### `InventoryRepository` (Interface)

**ファイルパス**: `src/Contexts/EC/Inventory/domain/InventoryRepository.ts`

```typescript
interface InventoryRepository {
  save(inventory: Inventory): Promise<void>;
  findByProductId(productId: ProductId): Promise<Inventory | null>;
  // 楽観的ロックを使った在庫引き当て専用メソッド（MongoDB実装で findOneAndUpdate を使用）
  reserveStock(params: {
    productId: ProductId;
    quantity: number;
    expectedVersion: number;
  }): Promise<ReserveStockResult>;
}

type ReserveStockResult =
  | { success: true; remainingStock: number; newVersion: number }
  | { success: false; reason: "INSUFFICIENT_STOCK" | "VERSION_CONFLICT" };
```

**設計ポイント**:

- `reserveStock()` はDB層でatomicな `findOneAndUpdate` を実行するためのポート
- `Inventory.reserve()` はDomainEvent生成を担い、実際のDB更新はこのメソッドが担う
- `ReserveStockResult` のunion型によりアプリケーション層が成功/失敗パターンを型安全に処理できる
- PostgreSQL移行時は `reserveStock()` の実装を差し替えるだけでよい（インターフェースは維持）

---

## ドメインエラー一覧

| エラークラス                        | 発生箇所                                             | 説明                              |
| ----------------------------------- | ---------------------------------------------------- | --------------------------------- |
| `InvalidOrderIdError`               | `OrderId` constructor                                | 無効なID形式                      |
| `InvalidOrderStatusTransitionError` | `Order.confirmInventory()` / `Order.failInventory()` | 不正なステータス遷移              |
| `EmptyOrderItemsError`              | `OrderItems` constructor                             | 注文明細が空                      |
| `InvalidOrderItemError`             | `OrderItem` constructor                              | quantity ≤ 0 または unitPrice < 0 |
| `InvalidTotalAmountError`           | `TotalAmount` constructor                            | 合計金額 < 0                      |
| `InvalidProductIdError`             | `ProductId` constructor                              | 無効なID形式                      |
| `InvalidStockQuantityError`         | `StockQuantity` constructor / `decrement()`          | 在庫数 < 0                        |

---

## 集約間の関係サマリー

```
PlaceOrderCommand
  ↓
Order.place()
  └─ record(OrderPlacedDomainEvent) → Monitoring が購読
                                    → EC/Inventory が購読
        ↓
        ReserveInventoryOnOrderPlaced (Subscriber)
          ↓
          InventoryRepository.reserveStock()  ← MongoDB findOneAndUpdate
          ↓
          Inventory.reserve()
            ├─ 成功 → record(InventoryReservedDomainEvent)          → Monitoring が購読
            └─ 失敗 → record(InventoryReservationFailedDomainEvent) → Monitoring が購読（在庫切れビジネスエラー）
```

---

## 次のStep（Step 3）で設計すること

- `PlaceOrderCommandHandler`: `Order.place()` の呼び出し、`EventBus.publish()` への委譲
- `ReserveInventoryCommandHandler`: `InventoryRepository.reserveStock()` の結果に基づいた `Inventory.reserve()` の呼び出し
- `GetOrderQueryHandler`: CQRSのRead側（MongoOrderRepositoryから直接読み取り）
- `ReserveInventoryOnOrderPlaced` Subscriber: RabbitMQキュー命名規則 `ec-backend.ec.order.placed.reserve-inventory-on-order-placed`

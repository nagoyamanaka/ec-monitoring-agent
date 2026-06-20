import { Inventory } from "../domain/Inventory.js";
import {
  InventoryRepository,
  ReserveStockResult,
} from "../domain/InventoryRepository.js";
import { InventoryFailureReasons } from "../domain/InventoryFailureReason.js";
import { ProductId } from "../domain/ProductId.js";
import { StockQuantity } from "../domain/StockQuantity.js";

export type InventoryMode =
  | "SUCCESS"
  | "INSUFFICIENT_STOCK"
  | "CONCURRENT_CONFLICT";

// 在庫予約の失敗をデモ用に強制する decorator。
// PaymentMockGateway の mode と同じ作法で、本番経路（SUCCESS）は内側 repo へ素通し。
// ReserveInventoryUseCase を一切変更せず、リポジトリ境界だけで2種の障害を再現する:
//   - INSUFFICIENT_STOCK: findByProductId を null にして validateStock を在庫不足で抜けさせる
//   - CONCURRENT_CONFLICT: 在庫十分な合成 Inventory を返して検証を通し、reserveStock を競合失敗させる
export class DemoInventoryRepository implements InventoryRepository {
  // デモ起動時に findByProductId が null だと scenario1(決済) も巻き込むため既定は SUCCESS（素通し）
  private mode: InventoryMode = "SUCCESS";
  private static readonly SYNTHETIC_STOCK = 1000;

  constructor(private readonly inner: InventoryRepository) {}

  setMode(mode: InventoryMode): void {
    this.mode = mode;
  }

  getMode(): InventoryMode {
    return this.mode;
  }

  async save(inventory: Inventory): Promise<void> {
    return this.inner.save(inventory);
  }

  async findByProductId(productId: ProductId): Promise<Inventory | null> {
    if (this.mode === "INSUFFICIENT_STOCK") {
      return null;
    }
    if (this.mode === "CONCURRENT_CONFLICT") {
      // seed に依存せず検証を通すための合成在庫
      return Inventory.initialize({
        productId,
        initialStock: new StockQuantity(DemoInventoryRepository.SYNTHETIC_STOCK),
      });
    }
    return this.inner.findByProductId(productId);
  }

  async reserveStock(params: {
    productId: ProductId;
    quantity: number;
    expectedVersion: number;
  }): Promise<ReserveStockResult> {
    if (this.mode === "CONCURRENT_CONFLICT") {
      return {
        success: false,
        reason: InventoryFailureReasons.CONCURRENT_CONFLICT,
      };
    }
    return this.inner.reserveStock(params);
  }
}

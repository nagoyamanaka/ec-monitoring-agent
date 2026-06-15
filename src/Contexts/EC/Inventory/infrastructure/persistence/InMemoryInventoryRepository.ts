import { Inventory } from "../../domain/Inventory.js";
import { ProductId } from "../../domain/ProductId.js";
import { InventoryRepository, ReserveStockResult } from "../../domain/InventoryRepository.js";

export class InMemoryInventoryRepository implements InventoryRepository {
  private readonly store = new Map<
    string,
    { productId: string; stock: number; version: number; updatedAt: Date }
  >();

  async save(inventory: Inventory): Promise<void> {
    this.store.set(inventory.productId.value, inventory.toPrimitives());
  }

  async findByProductId(productId: ProductId): Promise<Inventory | null> {
    const data = this.store.get(productId.value);
    if (!data) return null;
    return Inventory.fromPrimitives(data);
  }

  async reserveStock(params: {
    productId: ProductId;
    quantity: number;
    expectedVersion: number;
  }): Promise<ReserveStockResult> {
    const data = this.store.get(params.productId.value);

    if (!data) {
      return { success: false, reason: "INSUFFICIENT_STOCK" };
    }

    if (data.version !== params.expectedVersion) {
      return { success: false, reason: "CONCURRENT_CONFLICT" };
    }

    if (data.stock < params.quantity) {
      return { success: false, reason: "INSUFFICIENT_STOCK" };
    }

    const remainingStock = data.stock - params.quantity;
    const newVersion = data.version + 1;

    this.store.set(params.productId.value, {
      ...data,
      stock: remainingStock,
      version: newVersion,
      updatedAt: new Date(),
    });

    return { success: true, remainingStock, newVersion };
  }

  clear(): void {
    this.store.clear();
  }
}

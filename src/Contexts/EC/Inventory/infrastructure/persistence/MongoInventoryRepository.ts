import { InventoryRepository, ReserveStockResult } from "../../domain/InventoryRepository.js";
import { Inventory } from "../../domain/Inventory.js";
import { ProductId } from "../../domain/ProductId.js";

// TODO(Step3): Implement using mongodb driver with findOneAndUpdate for reserveStock
export class MongoInventoryRepository implements InventoryRepository {
  async save(_inventory: Inventory): Promise<void> {
    throw new Error("Not implemented");
  }

  async findByProductId(_productId: ProductId): Promise<Inventory | null> {
    throw new Error("Not implemented");
  }

  async reserveStock(_params: {
    productId: ProductId;
    quantity: number;
    expectedVersion: number;
  }): Promise<ReserveStockResult> {
    throw new Error("Not implemented");
  }
}

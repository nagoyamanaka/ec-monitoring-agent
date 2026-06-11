import { Inventory } from "./Inventory.js";
import { ProductId } from "./ProductId.js";
import { InventoryFailureReasonValue } from "./events/InventoryReservationFailedDomainEvent.js";

export type ReserveStockResult =
  | { success: true; remainingStock: number; newVersion: number }
  | { success: false; reason: Extract<InventoryFailureReasonValue, "INSUFFICIENT_STOCK" | "CONCURRENT_CONFLICT"> };

export interface InventoryRepository {
  save(inventory: Inventory): Promise<void>;
  findByProductId(productId: ProductId): Promise<Inventory | null>;
  /**
   * Atomic stock reservation using MongoDB findOneAndUpdate with optimistic locking.
   * Returns the outcome so the application layer can call Inventory.reserve() to emit events.
   */
  reserveStock(params: {
    productId: ProductId;
    quantity: number;
    expectedVersion: number;
  }): Promise<ReserveStockResult>;
}

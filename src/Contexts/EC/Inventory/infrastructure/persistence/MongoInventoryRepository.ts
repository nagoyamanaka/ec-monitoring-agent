// @ts-nocheck
import { MongoClient } from "mongodb";
import { MongoRepository } from "../../../../Shared/infrastructure/persistence/mongo/MongoRepository.js";
import { Inventory } from "../../domain/Inventory.js";
import { ProductId } from "../../domain/ProductId.js";
import {
  InventoryRepository,
  ReserveStockResult,
} from "../../domain/InventoryRepository.js";

export class MongoInventoryRepository
  extends MongoRepository<Inventory>
  implements InventoryRepository
{
  protected collectionName(): string {
    return "inventory";
  }

  async save(inventory: Inventory): Promise<void> {
    await this.persist(inventory.productId.value, inventory);
  }

  async findByProductId(productId: ProductId): Promise<Inventory | null> {
    const doc = await this.collection().findOne({ _id: productId.value });
    if (!doc) return null;

    const { _id, ...rest } = doc;
    return Inventory.fromPrimitives({ productId: _id, ...rest });
  }

  async reserveStock(params: {
    productId: ProductId;
    quantity: number;
    expectedVersion: number;
  }): Promise<ReserveStockResult> {
    const result = await this.collection().findOneAndUpdate(
      {
        _id: params.productId.value,
        version: params.expectedVersion,
        stock: { $gte: params.quantity }, // stock >= quantityであることを条件付け
      },
      {
        $inc: { stock: -params.quantity, version: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" },
    );

    if (result) {
      return {
        success: true,
        remainingStock: result.stock,
        newVersion: result.version,
      };
    }

    const existing = await this.collection().findOne({
      _id: params.productId.value,
    });
    if (!existing || existing.stock < params.quantity) {
      return { success: false, reason: "INSUFFICIENT_STOCK" };
    }
    return { success: false, reason: "CONCURRENT_CONFLICT" };
  }
}

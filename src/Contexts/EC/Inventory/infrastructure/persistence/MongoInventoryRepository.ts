import { Document, Filter } from "mongodb";
import { MongoRepository } from "../../../../Shared/infrastructure/persistence/mongo/MongoRepository.js";
import { Inventory } from "../../domain/Inventory.js";
import { ProductId } from "../../domain/ProductId.js";
import {
  InventoryRepository,
  ReserveStockResult,
} from "../../domain/InventoryRepository.js";
import { InventoryFailureReasons } from "../../domain/InventoryFailureReason.js";

type InventoryDoc = { _id: string; stock: number; version: number } & Record<string, unknown>;

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
    const doc = await this.collection().findOne(
      { _id: productId.value } as unknown as Filter<Document>,
    );
    if (!doc) return null;

    const { _id, ...rest } = doc as unknown as InventoryDoc;
    return Inventory.fromPrimitives(
      { productId: _id, ...rest } as Parameters<typeof Inventory.fromPrimitives>[0],
    );
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
        stock: { $gte: params.quantity },
      } as unknown as Filter<Document>,
      {
        $inc: { stock: -params.quantity, version: 1 },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" },
    );

    if (result) {
      const doc = result as unknown as InventoryDoc;
      return {
        success: true,
        remainingStock: doc.stock,
        newVersion: doc.version,
      };
    }

    const existing = await this.collection().findOne(
      { _id: params.productId.value } as unknown as Filter<Document>,
    );
    if (!existing || (existing as unknown as InventoryDoc).stock < params.quantity) {
      return { success: false, reason: InventoryFailureReasons.INSUFFICIENT_STOCK };
    }
    return { success: false, reason: InventoryFailureReasons.CONCURRENT_CONFLICT };
  }
}

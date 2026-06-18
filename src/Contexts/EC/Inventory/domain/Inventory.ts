import { AggregateRoot } from "../../../Shared/domain/AggregateRoot.js";
import { ProductId } from "./ProductId.js";
import { StockQuantity } from "./StockQuantity.js";
import { OrderItemPrimitive } from "../../Orders/domain/OrderItem.js";
import { InventoryReservedDomainEvent } from "./InventoryReservedDomainEvent.js";
import { InventoryReservationFailedDomainEvent } from "./InventoryReservationFailedDomainEvent.js";
import {
  InventoryFailureReason,
  InventoryFailureReasons,
} from "./InventoryFailureReason.js";

type InventoryPrimitives = {
  productId: string;
  stock: number;
  version: number;
  updatedAt: Date;
};

export class Inventory extends AggregateRoot {
  private constructor(
    readonly productId: ProductId,
    private _stock: StockQuantity,
    private _version: number,
    private _updatedAt: Date,
  ) {
    super();
  }

  get stock(): StockQuantity {
    return this._stock;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static initialize(params: {
    productId: ProductId;
    initialStock: StockQuantity;
  }): Inventory {
    return new Inventory(params.productId, params.initialStock, 0, new Date());
  }

  /**
   * Generates appropriate DomainEvent based on reservation outcome.
   * The actual atomic DB update is performed by InventoryRepository.reserveStock().
   * This method is called after reserveStock() completes to emit the correct event.
   */
  reserve(
    orderId: string,
    quantity: number,
    outcome:
      | { success: true; remainingStock: number; newVersion: number }
      | { success: false; reason: InventoryFailureReasons },
  ): void {
    if (outcome.success) {
      this._stock = new StockQuantity(outcome.remainingStock);
      this._version = outcome.newVersion;
      this._updatedAt = new Date();

      this.record(
        new InventoryReservedDomainEvent({
          productId: this.productId.value,
          orderId,
          reservedQuantity: quantity,
          remainingStock: outcome.remainingStock,
        }),
      );
    } else {
      this.record(
        new InventoryReservationFailedDomainEvent({
          productId: this.productId.value,
          orderId,
          requestedQuantity: quantity,
          currentStock: this._stock.value,
          reason: InventoryFailureReason.fromString(outcome.reason),
        }),
      );
    }
  }

  static fromPrimitives(params: InventoryPrimitives): Inventory {
    return new Inventory(
      new ProductId(params.productId),
      new StockQuantity(params.stock),
      params.version,
      params.updatedAt,
    );
  }

  toPrimitives(): InventoryPrimitives {
    return {
      productId: this.productId.value,
      stock: this._stock.value,
      version: this._version,
      updatedAt: this._updatedAt,
    };
  }
}

export type { OrderItemPrimitive };
export { InventoryFailureReason, InventoryFailureReasons };

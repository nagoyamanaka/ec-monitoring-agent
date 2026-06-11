import { ValueObject } from "../../../Shared/domain/ValueObject.js";
import { DomainError } from "../../../Shared/domain/DomainError.js";

export class InvalidStockQuantityError extends DomainError {
  readonly errorCode = "INVALID_STOCK_QUANTITY";

  constructor(value: number) {
    super(`StockQuantity must be >= 0, got: ${value}`);
  }
}

export class StockQuantity extends ValueObject<number> {
  constructor(value: number) {
    if (value < 0) {
      throw new InvalidStockQuantityError(value);
    }
    super(value);
  }

  hasEnoughStock(quantity: number): boolean {
    return this.value >= quantity;
  }

  decrement(quantity: number): StockQuantity {
    const result = this.value - quantity;
    if (result < 0) {
      throw new InvalidStockQuantityError(result);
    }
    return new StockQuantity(result);
  }

  increment(quantity: number): StockQuantity {
    return new StockQuantity(this.value + quantity);
  }
}

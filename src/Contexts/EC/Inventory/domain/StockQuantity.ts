import { NumberValueObject } from "../../../Shared/domain/value-object/NumberValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/value-object/InvalidArgumentError.js";

export class StockQuantity extends NumberValueObject {
  constructor(value: number) {
    super(value);
    if (value < 0) {
      throw new InvalidArgumentError(
        `StockQuantity must be >= 0, got: ${value}`,
      );
    }
  }

  hasEnoughStock(quantity: number): boolean {
    return this.value >= quantity;
  }

  decrement(quantity: number): StockQuantity {
    const result = this.value - quantity;
    if (result < 0) {
      throw new InvalidArgumentError(
        `StockQuantity cannot be decremented below 0, got: ${result}`,
      );
    }
    return new StockQuantity(result);
  }

  increment(quantity: number): StockQuantity {
    return new StockQuantity(this.value + quantity);
  }
}

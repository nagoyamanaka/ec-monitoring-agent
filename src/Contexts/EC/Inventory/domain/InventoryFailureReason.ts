import { EnumValueObject } from "../../../Shared/domain/value-object/EnumValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export enum InventoryFailureReasons {
  INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK",
  CONCURRENT_CONFLICT = "CONCURRENT_CONFLICT",
}

export class InventoryFailureReason extends EnumValueObject<InventoryFailureReasons> {
  constructor(value: InventoryFailureReasons) {
    super(value, Object.values(InventoryFailureReasons));
  }

  static insufficientStock(): InventoryFailureReason {
    return new InventoryFailureReason(
      InventoryFailureReasons.INSUFFICIENT_STOCK,
    );
  }

  static concurrentConflict(): InventoryFailureReason {
    return new InventoryFailureReason(
      InventoryFailureReasons.CONCURRENT_CONFLICT,
    );
  }

  static fromString(value: string): InventoryFailureReason {
    return new InventoryFailureReason(value as InventoryFailureReasons);
  }

  isInsufficientStock(): boolean {
    return this.value === InventoryFailureReasons.INSUFFICIENT_STOCK;
  }

  isConcurrentConflict(): boolean {
    return this.value === InventoryFailureReasons.CONCURRENT_CONFLICT;
  }

  protected throwErrorForInvalidValue(value: InventoryFailureReasons): void {
    throw new InvalidArgumentError(
      `Invalid InventoryFailureReason: "${value}"`,
    );
  }
}

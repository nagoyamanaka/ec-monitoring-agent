import { ValueObject } from "../../../Shared/domain/ValueObject.js";
import { DomainError } from "../../../Shared/domain/DomainError.js";

export class InvalidTotalAmountError extends DomainError {
  readonly errorCode = "INVALID_TOTAL_AMOUNT";

  constructor(value: number) {
    super(`TotalAmount must be >= 0, got: ${value}`);
  }
}

export class TotalAmount extends ValueObject<number> {
  constructor(value: number) {
    if (value < 0) {
      throw new InvalidTotalAmountError(value);
    }
    super(value);
  }
}

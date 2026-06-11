import { ValueObject } from "../../../Shared/domain/ValueObject.js";
import { DomainError } from "../../../Shared/domain/DomainError.js";

export class InvalidProductIdError extends DomainError {
  readonly errorCode = "INVALID_PRODUCT_ID";

  constructor(value: string) {
    super(`Invalid ProductId: "${value}"`);
  }
}

export class ProductId extends ValueObject<string> {
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new InvalidProductIdError(value);
    }
    super(value);
  }
}

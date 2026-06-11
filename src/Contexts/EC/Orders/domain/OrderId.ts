import { ValueObject } from "../../../Shared/domain/ValueObject.js";
import { DomainError } from "../../../Shared/domain/DomainError.js";

export class InvalidOrderIdError extends DomainError {
  readonly errorCode = "INVALID_ORDER_ID";

  constructor(value: string) {
    super(`Invalid OrderId: "${value}"`);
  }
}

export class OrderId extends ValueObject<string> {
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new InvalidOrderIdError(value);
    }
    super(value);
  }

  static create(value: string): OrderId {
    return new OrderId(value);
  }
}

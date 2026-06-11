import { ValueObject } from "../../../Shared/domain/ValueObject.js";
import { DomainError } from "../../../Shared/domain/DomainError.js";

export class InvalidCustomerIdError extends DomainError {
  readonly errorCode = "INVALID_CUSTOMER_ID";

  constructor(value: string) {
    super(`Invalid CustomerId: "${value}"`);
  }
}

export class CustomerId extends ValueObject<string> {
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new InvalidCustomerIdError(value);
    }
    super(value);
  }
}

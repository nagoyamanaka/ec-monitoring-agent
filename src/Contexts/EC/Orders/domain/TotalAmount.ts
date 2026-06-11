import { NumberValueObject } from "../../../Shared/domain/value-object/NumberValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/value-object/InvalidArgumentError.js";

export class TotalAmount extends NumberValueObject {
  constructor(value: number) {
    super(value);
    if (value < 0) {
      throw new InvalidArgumentError(`TotalAmount must be >= 0, got: ${value}`);
    }
  }
}

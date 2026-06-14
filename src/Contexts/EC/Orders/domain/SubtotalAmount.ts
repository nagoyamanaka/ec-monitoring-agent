import { NumberValueObject } from "../../../Shared/domain/value-object/NumberValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export class SubtotalAmount extends NumberValueObject {
  constructor(value: number) {
    super(value);
    if (value < 0) {
      throw new InvalidArgumentError(`SubtotalAmount must be >= 0, got: ${value}`);
    }
  }
}

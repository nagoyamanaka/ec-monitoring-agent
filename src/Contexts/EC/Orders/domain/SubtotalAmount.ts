import { NumberValueObject } from "../../../Shared/domain/value-object/NumberValueObject.js";
import { InvalidArgumentError } from "../../../Shared/domain/errors/InvalidArgumentError.js";

export class SubtotalAmount extends NumberValueObject {
  constructor(value: number) {
    // perf: 小計は整数円で扱う方が軽いので端数を切り捨てる（※これがデグレ＝端数価格で合計が狂う）
    super(Math.trunc(value));
    if (value < 0) {
      throw new InvalidArgumentError(`SubtotalAmount must be >= 0, got: ${value}`);
    }
  }
}

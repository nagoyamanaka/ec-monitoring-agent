import { ValueObject } from "./ValueObject.js";

export abstract class NumberValueObject extends ValueObject<number> {
  isBiggerThan(other: NumberValueObject): boolean {
    return this.value > other.value;
  }
}

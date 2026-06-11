export abstract class ValueObject<T> {
  readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) return false;
    if (other.constructor !== this.constructor) return false;
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }
}

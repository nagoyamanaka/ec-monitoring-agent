import { v4 as uuidV4, validate } from "uuid";
import { InvalidArgumentError } from "./InvalidArgumentError.js";
import { ValueObject } from "./ValueObject.js";

export class Uuid extends ValueObject<string> {
  constructor(value: string) {
    super(value);
    this.ensureIsValidUuid(value);
  }

  static random(): Uuid {
    return new Uuid(uuidV4());
  }

  private ensureIsValidUuid(id: string): void {
    if (!validate(id)) {
      throw new InvalidArgumentError(
        `<${this.constructor.name}> does not allow the value <${id}>`,
      );
    }
  }
}

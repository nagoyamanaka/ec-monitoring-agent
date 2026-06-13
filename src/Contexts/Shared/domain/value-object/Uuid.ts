import { InvalidArgumentError } from "../errors/InvalidArgumentError.js";
import { StringValueObject } from "./StringValueObject.js";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class Uuid extends StringValueObject {
  constructor(value: string) {
    super(value);
    this.ensureIsValidUuid(value);
  }

  static random(): Uuid {
    return new Uuid(crypto.randomUUID());
  }

  private ensureIsValidUuid(id: string): void {
    if (!UUID_V4_REGEX.test(id)) {
      throw new InvalidArgumentError(
        `<${this.constructor.name}> does not allow the value <${id}>`,
      );
    }
  }
}

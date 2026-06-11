import { StringValueObject } from "../value-object/StringValueObject.js";

export class OrderBy extends StringValueObject {
  constructor(value: string) {
    super(value);
  }
}

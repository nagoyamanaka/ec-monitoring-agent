import { StringValueObject } from "../value-object/StringValueObject.js";

export class FilterValue extends StringValueObject {
  constructor(value: string) {
    super(value);
  }
}

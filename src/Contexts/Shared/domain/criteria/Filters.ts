import { Filter } from "./Filter.js";

export class Filters {
  readonly filters: Filter[];

  constructor(filters: Filter[]) {
    this.filters = filters;
  }

  static none(): Filters {
    return new Filters([]);
  }

  static fromValues(
    filters: Array<{ field: string; operator: string; value: string }>,
  ): Filters {
    return new Filters(filters.map(Filter.fromValues));
  }

  isEmpty(): boolean {
    return this.filters.length === 0;
  }
}

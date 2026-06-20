import { Response } from "../../../../Shared/domain/Response.js";
import {
  KnownErrorPattern,
  KnownErrorPatternPrimitives,
} from "../../domain/KnownErrorPattern.js";

export class PatternResponse implements Response {
  public readonly patterns: KnownErrorPatternPrimitives[];

  constructor(patterns: KnownErrorPattern[]) {
    this.patterns = patterns.map((p) => p.toPrimitives());
  }
}

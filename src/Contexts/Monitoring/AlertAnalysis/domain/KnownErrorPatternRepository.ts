import { KnownErrorPattern } from "./KnownErrorPattern.js";

export interface KnownErrorPatternRepository {
  findAll(): Promise<KnownErrorPattern[]>;
  save(pattern: KnownErrorPattern): Promise<void>;
}

import { KnownErrorPattern } from "./KnownErrorPattern.js";

export interface KnownErrorPatternRepository {
  save(pattern: KnownErrorPattern): Promise<void>;
  findById(id: string): Promise<KnownErrorPattern | null>;
  findAll(): Promise<KnownErrorPattern[]>;
}

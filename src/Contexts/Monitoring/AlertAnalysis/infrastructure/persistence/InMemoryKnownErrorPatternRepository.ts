import { KnownErrorPattern } from "../../domain/KnownErrorPattern.js";
import { KnownErrorPatternRepository } from "../../domain/KnownErrorPatternRepository.js";

export class InMemoryKnownErrorPatternRepository implements KnownErrorPatternRepository {
  private patterns: KnownErrorPattern[];

  constructor(initialPatterns: KnownErrorPattern[] = []) {
    this.patterns = [...initialPatterns];
  }

  async findAll(): Promise<KnownErrorPattern[]> {
    return [...this.patterns];
  }

  async findById(id: string): Promise<KnownErrorPattern | null> {
    return this.patterns.find((p) => p.id === id) ?? null;
  }

  async save(pattern: KnownErrorPattern): Promise<void> {
    const index = this.patterns.findIndex((p) => p.id === pattern.id);
    if (index >= 0) {
      this.patterns[index] = pattern;
    } else {
      this.patterns.push(pattern);
    }
  }
}

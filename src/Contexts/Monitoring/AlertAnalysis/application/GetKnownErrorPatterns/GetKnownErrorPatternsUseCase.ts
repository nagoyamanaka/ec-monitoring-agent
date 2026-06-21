import { KnownErrorPatternRepository } from "../../domain/KnownErrorPatternRepository.js";
import { PatternResponse } from "./PatternResponse.js";

export class GetKnownErrorPatternsUseCase {
  constructor(
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
  ) {}

  async run(): Promise<PatternResponse> {
    const patterns = await this.knownErrorPatternRepository.findAll();
    return new PatternResponse(patterns);
  }
}

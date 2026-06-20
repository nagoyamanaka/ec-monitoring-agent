import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { KnownErrorPatternRepository } from "../../domain/KnownErrorPatternRepository.js";
import { MonitoringResourceNotFoundError } from "../errors/MonitoringResourceNotFoundError.js";

export class PromotePatternUseCase {
  constructor(
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
    private readonly logger: Logger,
  ) {}

  async run(params: { patternId: string }): Promise<void> {
    const { patternId } = params;

    const pattern = await this.knownErrorPatternRepository.findById(patternId);
    if (pattern === null) {
      throw new MonitoringResourceNotFoundError("KnownErrorPattern", patternId);
    }

    const promoted = pattern.promote();
    await this.knownErrorPatternRepository.save(promoted);

    await this.logger.info({
      service: "backoffice-backend",
      action: "pattern_promoted",
      message: `パターン手動昇格：${promoted.id}, pattern=${promoted.name}`,
    });
  }
}

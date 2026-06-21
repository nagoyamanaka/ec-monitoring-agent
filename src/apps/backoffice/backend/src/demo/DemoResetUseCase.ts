import { KnownErrorPatternRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/KnownErrorPatternRepository.js";
import { KNOWN_ERROR_PATTERN_SEEDS } from "../../../../../Contexts/Monitoring/seeds/KnownErrorPatternSeed.js";
import { DemoDataPort } from "./DemoDataPort.js";

// デモ起動時のクリーンスレート化。
// alert を全消去し、既知パターンを seed の初期状態（未昇格）に戻す。
export class DemoResetUseCase {
  constructor(
    private readonly demoDataPort: DemoDataPort,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
  ) {}

  async run(): Promise<{ alertsCleared: true; patternsSeeded: number }> {
    await this.demoDataPort.clearAlerts();
    await this.demoDataPort.clearPatterns();

    for (const pattern of KNOWN_ERROR_PATTERN_SEEDS) {
      await this.knownErrorPatternRepository.save(pattern);
    }

    return { alertsCleared: true, patternsSeeded: KNOWN_ERROR_PATTERN_SEEDS.length };
  }
}

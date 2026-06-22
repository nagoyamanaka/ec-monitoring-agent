import { AlertRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/AlertRepository.js";
import { KnownErrorPatternRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/KnownErrorPatternRepository.js";
import { ALERT_SEEDS } from "../../../../../Contexts/Monitoring/seeds/AlertSeed.js";
import { KNOWN_ERROR_PATTERN_SEEDS } from "../../../../../Contexts/Monitoring/seeds/KnownErrorPatternSeed.js";
import { DemoDataPort } from "./DemoDataPort.js";

// デモ起動時のクリーンスレート化。
// alert・既知パターンを全消去し、それぞれの seed 初期状態に戻す。
export class DemoResetUseCase {
  constructor(
    private readonly demoDataPort: DemoDataPort,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
    private readonly alertRepository: AlertRepository,
  ) {}

  async run(): Promise<{ alertsSeeded: number; patternsSeeded: number }> {
    await this.demoDataPort.clearAlerts();
    await this.demoDataPort.clearPatterns();

    for (const pattern of KNOWN_ERROR_PATTERN_SEEDS) {
      await this.knownErrorPatternRepository.save(pattern);
    }

    for (const alert of ALERT_SEEDS) {
      await this.alertRepository.save(alert);
    }

    return { alertsSeeded: ALERT_SEEDS.length, patternsSeeded: KNOWN_ERROR_PATTERN_SEEDS.length };
  }
}

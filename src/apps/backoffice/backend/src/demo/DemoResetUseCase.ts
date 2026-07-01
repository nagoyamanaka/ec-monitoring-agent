import { KnownErrorPatternRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/KnownErrorPatternRepository.js";
import { KNOWN_ERROR_PATTERN_SEEDS } from "../../../../../Contexts/Monitoring/seeds/KnownErrorPatternSeed.js";
import { DemoDataPort } from "./DemoDataPort.js";

// デモ起動時のクリーンスレート化。
// alert・既知パターン・リメディエーション記録を全消去し、既知パターン（分類の知識ベース）
// のみを再seedする。アラート一覧は空で起動し、審査員はデモシナリオを押して結果を観察する。
// 既知一致でも調査レポートは AI が今回の具体パラメータで生成するため（既知パターンは
// grounding 文脈として渡る）、一覧を静的ダミーで埋めない。
export class DemoResetUseCase {
  constructor(
    private readonly demoDataPort: DemoDataPort,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
  ) {}

  async run(): Promise<{ alertsSeeded: number; patternsSeeded: number }> {
    await this.demoDataPort.clearAlerts();
    await this.demoDataPort.clearPatterns();
    await this.demoDataPort.clearRemediations();

    for (const pattern of KNOWN_ERROR_PATTERN_SEEDS) {
      await this.knownErrorPatternRepository.save(pattern);
    }

    return { alertsSeeded: 0, patternsSeeded: KNOWN_ERROR_PATTERN_SEEDS.length };
  }
}

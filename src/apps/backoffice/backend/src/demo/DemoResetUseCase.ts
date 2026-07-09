import { AlertRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/AlertRepository.js";
import { KnownErrorPatternRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/KnownErrorPatternRepository.js";
import { SimilarIncidentRepository } from "../../../../../Contexts/Monitoring/SimilarIncident/domain/SimilarIncidentRepository.js";
import { KNOWN_ERROR_PATTERN_SEEDS } from "../../../../../Contexts/Monitoring/seeds/KnownErrorPatternSeed.js";
import {
  RESOLVED_INCIDENT_SEEDS,
  SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID,
} from "../../../../../Contexts/Monitoring/seeds/ResolvedIncidentSeed.js";
import { RESOLVED_ALERT_SEEDS } from "../../../../../Contexts/Monitoring/seeds/ResolvedAlertSeed.js";
import { DemoDataPort } from "./DemoDataPort.js";

// デモ起動時のクリーンスレート化。
// alert・既知パターン・リメディエーション記録を全消去し、分類の知識ベース（既知パターン＋
// 「類似・準既知」用の解決済み事例）と、関連アラート導線用の**解決済みアーカイブ Alert** を再seedする。
// 現役アラート一覧は空で起動し（RESOLVED は GET /alerts から除外）、審査員はデモシナリオを押して観察する。
// 既知一致でも調査レポートは AI がオンデマンドで生成し（既知は自動起動しない）、一覧を静的ダミーで埋めない。
export class DemoResetUseCase {
  constructor(
    private readonly demoDataPort: DemoDataPort,
    private readonly knownErrorPatternRepository: KnownErrorPatternRepository,
    private readonly similarIncidentRepository: SimilarIncidentRepository,
    private readonly alertRepository: AlertRepository,
  ) {}

  async run(): Promise<{
    alertsSeeded: number;
    patternsSeeded: number;
    incidentsSeeded: number;
  }> {
    await this.demoDataPort.clearAlerts();
    await this.demoDataPort.clearPatterns();
    await this.demoDataPort.clearRemediations();

    for (const pattern of KNOWN_ERROR_PATTERN_SEEDS) {
      await this.knownErrorPatternRepository.save(pattern);
    }

    // 「類似・準既知」シナリオ用の解決済み事例を再seed。まずコーパスを全消去してクリーンスレートにする
    // （removeByAlertId は seed 由来 id しか消せず、過去セッションで承認学習された別 id の事例が蓄積して
    // 類似検索を汚す＝古い語彙の resolvedNote が表示に勝つ）。clear 未実装の fake backend では
    // seed 由来 id の撤回にフォールバックして従来の冪等性を保つ。
    if (this.similarIncidentRepository.clear) {
      await this.similarIncidentRepository.clear();
    }
    for (const incident of RESOLVED_INCIDENT_SEEDS) {
      if (!this.similarIncidentRepository.clear) {
        await this.similarIncidentRepository.removeByAlertId(
          incident.sourceAlertId ?? SIMILAR_INCIDENT_SEED_SOURCE_ALERT_ID,
        );
      }
      await this.similarIncidentRepository.index(incident);
    }

    // 解決済みアーカイブ Alert（RESOLVED）を再seed。類似分類の sourceAlertId から関連アラートとして
    // 開ける実体になる。一覧には出ない（GetAlertReportUseCase が RESOLVED を除外）ので clean start は保つ。
    for (const alert of RESOLVED_ALERT_SEEDS) {
      await this.alertRepository.save(alert);
    }

    return {
      alertsSeeded: 0, // 現役アラート（一覧に出る OPEN/ANALYZING）は 0。アーカイブは別枠。
      patternsSeeded: KNOWN_ERROR_PATTERN_SEEDS.length,
      incidentsSeeded: RESOLVED_INCIDENT_SEEDS.length,
    };
  }
}

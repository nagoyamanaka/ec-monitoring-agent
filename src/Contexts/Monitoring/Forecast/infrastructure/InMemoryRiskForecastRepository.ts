import { ForecastBriefing, RiskForecastRepository } from "../domain/ForecastBriefing.js";

// 最新予報のオンメモリ保管（単一プロセス前提・最小実装＝最新1件のみ）。
// 予報は再生成可能な read-model なので永続化しない（再起動後は POST で温め直す）。
export class InMemoryRiskForecastRepository implements RiskForecastRepository {
  private latest: ForecastBriefing | null = null;

  async saveLatest(briefing: ForecastBriefing): Promise<void> {
    this.latest = briefing;
  }

  async findLatest(): Promise<ForecastBriefing | null> {
    return this.latest;
  }

  async clearLatest(): Promise<void> {
    this.latest = null;
  }
}

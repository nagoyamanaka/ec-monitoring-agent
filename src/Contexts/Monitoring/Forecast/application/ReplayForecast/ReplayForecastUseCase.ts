import { EvidenceSnapshot, restoreForecastContext } from "../../domain/EvidenceSnapshot.js";
import { RiskForecast } from "../../domain/RiskForecast.js";
import { ForecastSynthesis } from "../ForecastRisk/ForecastSynthesis.js";

/**
 * 保存済みの証拠スナップショットだけを入力に予報を再実行する（T0-2）。
 * シグナル源・記憶・台帳・予報の保存には一切依存しない＝依存の形の上で「入力を取りに行けない」。
 * 予報の出し方は本番と同じ ForecastSynthesis（予報器＋引用検証）。
 * 外部通信の遮断は呼び出し側（sealed 実行・infrastructure）が担う。
 */
export class ReplayForecastUseCase {
  constructor(private readonly synthesis: ForecastSynthesis) {}

  async replay(snapshot: EvidenceSnapshot): Promise<RiskForecast> {
    return this.synthesis.forecast(restoreForecastContext(snapshot));
  }
}

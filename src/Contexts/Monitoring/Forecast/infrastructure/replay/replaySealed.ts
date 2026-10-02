import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { ForecastSynthesis } from "../../application/ForecastRisk/ForecastSynthesis.js";
import { ReplayForecastUseCase } from "../../application/ReplayForecast/ReplayForecastUseCase.js";
import { EvidenceSnapshot } from "../../domain/EvidenceSnapshot.js";
import { ForecastPort } from "../../domain/ForecastPort.js";
import { RiskForecast } from "../../domain/RiskForecast.js";
import { HostAllowlist, ReplayNetworkBlockedError, sealNetwork } from "./ReplayNetworkGuard.js";

/**
 * 外部通信を遮断した状態でリプレイを1回実行する（T0-2）。
 * 途中で遮断に当たった通信が1件でもあれば、予報器がその例外を握りつぶして
 * fallback を返していても失敗にする＝「snapshot 以外を見た予報」を結果として返さない。
 */
export async function replaySealed(params: {
  snapshot: EvidenceSnapshot;
  forecastPort: ForecastPort;
  logger: Logger;
  allow: HostAllowlist;
}): Promise<RiskForecast> {
  const useCase = new ReplayForecastUseCase(
    new ForecastSynthesis(params.forecastPort, params.logger),
  );
  const seal = sealNetwork(params.allow);
  let result: RiskForecast;
  try {
    result = await useCase.replay(params.snapshot);
  } finally {
    seal.restore();
  }
  if (seal.violations.length > 0) {
    throw new ReplayNetworkBlockedError(seal.violations);
  }
  return result;
}

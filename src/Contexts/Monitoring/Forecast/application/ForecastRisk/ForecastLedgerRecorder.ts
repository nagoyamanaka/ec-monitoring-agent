import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { ForecastBriefing } from "../../domain/ForecastBriefing.js";
import {
  ForecastLedgerRepository,
  ForecastLedgerStamp,
  issueForecasts,
} from "../../domain/ForecastLedger.js";

/**
 * 予報の保存直後に、risk ごとの issued を台帳へ追記する（T0-1）。
 * 台帳は記録であって予報の出し方ではないので、追記の失敗で予報の生成・配信を止めない
 * （error ログを残して縮退）。落ちた行は後から作れない＝ログで欠損を数えられるようにしておく。
 */
export class ForecastLedgerRecorder {
  constructor(
    private readonly ledger: ForecastLedgerRepository,
    private readonly stamp: ForecastLedgerStamp,
    private readonly logger: Logger,
  ) {}

  async record(briefing: ForecastBriefing): Promise<void> {
    const events = issueForecasts(briefing, this.stamp);
    for (const event of events) {
      try {
        await this.ledger.append(event);
      } catch (error) {
        await this.logger.error({
          service: "backoffice-backend",
          action: "forecast_ledger_append_failed",
          message: `予報台帳への追記に失敗しました: briefingId=${event.briefingId}, forecastId=${event.forecastId}, subject=${event.subjectKey}, error=${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }
}

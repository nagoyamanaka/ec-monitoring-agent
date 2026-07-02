import { Logger } from "../../../Shared/domain/logging/Logger.js";
import { ForecastSignal, ForecastSignalKind } from "../domain/ForecastSignal.js";
import { ForecastSignalSource } from "../domain/ForecastSignalSource.js";
import { ScheduleSource } from "../domain/ScheduleSource.js";
import { normalizeSubject } from "../domain/forecastSubject.js";

// 業務/負荷スケジュール（SCHEDULE）を ForecastSignal に正規化する。
// FUTURE_CHANGE（変更の意図）に対し、こちらは「いつ負荷が来るか」の時間窓を予報に与える。
export class ScheduleSignalSource implements ForecastSignalSource {
  constructor(
    private readonly scheduleSource: ScheduleSource,
    private readonly logger: Logger,
  ) {}

  async collect(horizon: string): Promise<ForecastSignal[]> {
    try {
      const windows = await this.scheduleSource.list(horizon);
      return windows.map((window, index) => ({
        id: `sch-${index + 1}`,
        kind: ForecastSignalKind.SCHEDULE,
        subject: normalizeSubject(window.subject),
        when: window.when,
        desc: `${window.subject} 負荷 ${window.load}`,
        source: "schedule",
      }));
    } catch (error) {
      // 予兆はベストエフォート＝1源の失敗で予報全体を落とさない（他シグナルで縮退継続）。
      await this.logger.warn({
        service: "backoffice-backend",
        action: "forecast_signal_collect_failed",
        message: `schedule シグナル収集に失敗しました（スキップ）：${(error as Error).message}`,
      });
      return [];
    }
  }
}

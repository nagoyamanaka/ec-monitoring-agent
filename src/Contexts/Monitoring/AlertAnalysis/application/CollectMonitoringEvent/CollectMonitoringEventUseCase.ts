import { Logger } from "../../../../Shared/domain/logging/Logger.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { AnalyzeAlertCommand } from "../AnalyzeAlert/AnalyzeAlertCommand.js";
import { AnalyzeAlertCommandHandler } from "../AnalyzeAlert/AnalyzeAlertCommandHandler.js";

export class CollectMonitoringEventUseCase {
  constructor(
    private readonly analyzeAlertCommandHandler: AnalyzeAlertCommandHandler,
    private readonly logger: Logger,
  ) {}

  async run(monitoringEvent: MonitoringEvent): Promise<void> {
    try {
      // 正常系の業務イベント（info）は観測として収集するがアラート判定にはかけない。
      // 分類→AI調査の手前で打ち切ることで、注文成功などが未知アラート化するのを防ぐ。
      // （将来 §7.10 の EventLog/forecast sink ができたら、ここから流す継ぎ目になる）
      if (!monitoringEvent.isAlertable()) {
        await this.logger.debug({
          service: "monitoring",
          action: "monitoring_event_observed_non_alertable",
          message: `観測のみ（アラート対象外）：${monitoringEvent.eventName} severity=${monitoringEvent.severity.value}`,
        });
        return;
      }

      const command = new AnalyzeAlertCommand(
        crypto.randomUUID(),
        monitoringEvent.toPrimitives(),
      );
      await this.analyzeAlertCommandHandler.handle(command);
      await this.logger.debug({
        service: "monitoring",
        action: "monitoring_event_collected",
        message: `ECイベントをMonitoringEventに変換：${monitoringEvent.eventName}`,
      });
    } catch (error) {
      await this.logger.error({
        service: "monitoring",
        action: "monitoring_event_collection_failed",
        message: `MonitoringEvent変換失敗：${monitoringEvent.eventName}`,
        stack_trace: error instanceof Error ? error.stack : String(error),
      });
      throw error;
    }
  }
}

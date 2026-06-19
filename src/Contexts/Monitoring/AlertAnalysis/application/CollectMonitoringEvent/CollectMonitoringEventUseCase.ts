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

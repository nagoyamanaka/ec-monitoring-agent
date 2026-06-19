import { Command } from "../../../../Shared/domain/Command.js";
import { MonitoringEventPrimitives } from "../../../Shared/domain/MonitoringEvent.js";

export class AnalyzeAlertCommand extends Command {
  constructor(
    readonly alertId: string,
    readonly monitoringEvent: MonitoringEventPrimitives,
  ) {
    super();
  }
}

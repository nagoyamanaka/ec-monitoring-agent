import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { AlertId } from "../../domain/AlertId.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { AnalyzeAlertCommand } from "./AnalyzeAlertCommand.js";
import { AnalyzeAlertUseCase } from "./AnalyzeAlertUseCase.js";

export class AnalyzeAlertCommandHandler
  implements CommandHandler<AnalyzeAlertCommand>
{
  constructor(private readonly analyzeAlertUseCase: AnalyzeAlertUseCase) {}

  subscribedTo() {
    return AnalyzeAlertCommand;
  }

  async handle(command: AnalyzeAlertCommand): Promise<void> {
    await this.analyzeAlertUseCase.run({
      alertId: new AlertId(command.alertId),
      monitoringEvent: MonitoringEvent.fromPrimitives(command.monitoringEvent),
    });
  }
}

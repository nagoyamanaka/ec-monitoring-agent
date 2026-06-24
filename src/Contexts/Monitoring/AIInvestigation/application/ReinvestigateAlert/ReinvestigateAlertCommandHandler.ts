import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { ReinvestigateAlertCommand } from "./ReinvestigateAlertCommand.js";
import { ReinvestigateAlertUseCase } from "./ReinvestigateAlertUseCase.js";

export class ReinvestigateAlertCommandHandler
  implements CommandHandler<ReinvestigateAlertCommand>
{
  constructor(private readonly useCase: ReinvestigateAlertUseCase) {}

  subscribedTo() {
    return ReinvestigateAlertCommand;
  }

  async handle(command: ReinvestigateAlertCommand): Promise<void> {
    await this.useCase.run({
      alertId: new AlertId(command.alertId),
      operatorNote: command.operatorNote,
    });
  }
}

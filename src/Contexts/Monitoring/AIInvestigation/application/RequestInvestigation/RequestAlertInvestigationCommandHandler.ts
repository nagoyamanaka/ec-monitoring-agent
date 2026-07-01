import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { RequestAlertInvestigationCommand } from "./RequestAlertInvestigationCommand.js";
import { RequestAlertInvestigationUseCase } from "./RequestAlertInvestigationUseCase.js";

export class RequestAlertInvestigationCommandHandler
  implements CommandHandler<RequestAlertInvestigationCommand>
{
  constructor(
    private readonly requestAlertInvestigationUseCase: RequestAlertInvestigationUseCase,
  ) {}

  subscribedTo() {
    return RequestAlertInvestigationCommand;
  }

  async handle(command: RequestAlertInvestigationCommand): Promise<void> {
    await this.requestAlertInvestigationUseCase.run({
      alertId: new AlertId(command.alertId),
    });
  }
}

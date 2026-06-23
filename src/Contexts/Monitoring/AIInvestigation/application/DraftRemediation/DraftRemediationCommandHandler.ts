import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { AlertId } from "../../../AlertAnalysis/domain/AlertId.js";
import { DraftRemediationCommand } from "./DraftRemediationCommand.js";
import { DraftRemediationUseCase } from "./DraftRemediationUseCase.js";

export class DraftRemediationCommandHandler
  implements CommandHandler<DraftRemediationCommand>
{
  constructor(private readonly useCase: DraftRemediationUseCase) {}

  subscribedTo() {
    return DraftRemediationCommand;
  }

  async handle(command: DraftRemediationCommand): Promise<void> {
    await this.useCase.run(new AlertId(command.alertId));
  }
}

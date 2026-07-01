import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { AlertId } from "../../domain/AlertId.js";
import { PromoteAlertCommand } from "./PromoteAlertCommand.js";
import { PromoteAlertUseCase } from "./PromoteAlertUseCase.js";

export class PromoteAlertCommandHandler
  implements CommandHandler<PromoteAlertCommand>
{
  constructor(private readonly promoteAlertUseCase: PromoteAlertUseCase) {}

  subscribedTo() {
    return PromoteAlertCommand;
  }

  async handle(command: PromoteAlertCommand): Promise<void> {
    await this.promoteAlertUseCase.run({ alertId: new AlertId(command.alertId) });
  }
}

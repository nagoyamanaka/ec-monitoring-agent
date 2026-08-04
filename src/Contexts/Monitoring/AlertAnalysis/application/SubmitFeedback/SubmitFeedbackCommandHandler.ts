import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { AlertId } from "../../domain/AlertId.js";
import { SubmitFeedbackCommand } from "./SubmitFeedbackCommand.js";
import { SubmitFeedbackUseCase } from "./SubmitFeedbackUseCase.js";

export class SubmitFeedbackCommandHandler
  implements CommandHandler<SubmitFeedbackCommand>
{
  constructor(private readonly submitFeedbackUseCase: SubmitFeedbackUseCase) {}

  subscribedTo() {
    return SubmitFeedbackCommand;
  }

  async handle(command: SubmitFeedbackCommand): Promise<void> {
    await this.submitFeedbackUseCase.run({
      alertId: new AlertId(command.alertId),
      isCorrect: command.isCorrect,
      operatorNote: command.operatorNote,
      decision: command.decision,
    });
  }
}

import { Command } from "../../../../Shared/domain/Command.js";

export class SubmitFeedbackCommand extends Command {
  constructor(
    readonly alertId: string,
    readonly isCorrect: boolean,
    readonly operatorNote?: string,
  ) {
    super();
  }
}

import { Command } from "../../../../Shared/domain/Command.js";

export class PromoteAlertCommand extends Command {
  constructor(readonly alertId: string) {
    super();
  }
}

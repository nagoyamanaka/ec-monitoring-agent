import { Command } from "../../../../Shared/domain/Command.js";

export class RequestAlertInvestigationCommand extends Command {
  constructor(readonly alertId: string) {
    super();
  }
}

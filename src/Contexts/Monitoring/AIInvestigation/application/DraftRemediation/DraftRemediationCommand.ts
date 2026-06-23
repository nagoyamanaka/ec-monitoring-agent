import { Command } from "../../../../Shared/domain/Command.js";

// アラート（security-scan 起源）に対し修正PR草案の起票をキックする write コマンド。
export class DraftRemediationCommand extends Command {
  constructor(readonly alertId: string) {
    super();
  }
}

import { Command } from "../../../../Shared/domain/Command.js";

export class PromotePatternCommand extends Command {
  constructor(readonly patternId: string) {
    super();
  }
}

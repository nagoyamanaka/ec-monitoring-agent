import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { PromotePatternCommand } from "./PromotePatternCommand.js";
import { PromotePatternUseCase } from "./PromotePatternUseCase.js";

export class PromotePatternCommandHandler
  implements CommandHandler<PromotePatternCommand>
{
  constructor(private readonly promotePatternUseCase: PromotePatternUseCase) {}

  subscribedTo() {
    return PromotePatternCommand;
  }

  async handle(command: PromotePatternCommand): Promise<void> {
    await this.promotePatternUseCase.run({ patternId: command.patternId });
  }
}

import { CommandHandler } from "../../../../Shared/domain/CommandHandler.js";
import { ForecastRiskCommand } from "./ForecastRiskCommand.js";
import { ForecastRiskUseCase } from "./ForecastRiskUseCase.js";

export class ForecastRiskCommandHandler implements CommandHandler<ForecastRiskCommand> {
  constructor(private readonly forecastRiskUseCase: ForecastRiskUseCase) {}

  subscribedTo() {
    return ForecastRiskCommand;
  }

  async handle(command: ForecastRiskCommand): Promise<void> {
    await this.forecastRiskUseCase.run({ horizon: command.horizon });
  }
}

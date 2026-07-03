import { Command } from "../../../../Shared/domain/Command.js";

export class ForecastRiskCommand extends Command {
  constructor(readonly horizon: string) {
    super();
  }
}

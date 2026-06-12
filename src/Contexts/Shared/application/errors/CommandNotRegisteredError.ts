import { Command } from "../../domain/Command.js";
import { ApplicationError } from "../../domain/errors/ApplicationError.js";

export class CommandNotRegisteredError extends ApplicationError {
  readonly errorCode = "COMMAND_NOT_REGISTERED";

  constructor(command: Command) {
    super(`The command <${command.constructor.name}> hasn't a command handler associated`);
  }
}

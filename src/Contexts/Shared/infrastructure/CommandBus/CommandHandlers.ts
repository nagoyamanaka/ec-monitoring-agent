import { Command } from '../../domain/Command.js';
import { CommandHandler } from '../../domain/CommandHandler.js';
import { CommandNotRegisteredError } from '../../application/errors/CommandNotRegisteredError.js';

export class CommandHandlers extends Map<Command, CommandHandler<Command>> {
  constructor(commandHandlers: Array<CommandHandler<Command>>) {
    super();

    commandHandlers.forEach(commandHandler => {
      this.set(commandHandler.subscribedTo(), commandHandler);
    });
  }

  public get(command: Command): CommandHandler<Command> {
    const commandHandler = super.get(command.constructor as unknown as Command);

    if (!commandHandler) {
      throw new CommandNotRegisteredError(command);
    }

    return commandHandler;
  }
}

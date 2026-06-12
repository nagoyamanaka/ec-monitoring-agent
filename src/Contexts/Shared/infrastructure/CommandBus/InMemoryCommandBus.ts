import { Command } from '../../domain/Command.js';
import { CommandBus } from './../../domain/CommandBus.js';
import { CommandHandlers } from './CommandHandlers.js';

export class InMemoryCommandBus implements CommandBus {
  constructor(private commandHandlers: CommandHandlers) {}

  async dispatch(command: Command): Promise<void> {
    const handler = this.commandHandlers.get(command);

    await handler.handle(command);
  }
}

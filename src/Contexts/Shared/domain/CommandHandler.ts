import { Command } from "./Command.js";

export interface CommandHandler<T extends Command> {
  subscribedTo(): Command;
  handle(command: T): Promise<void>;
}

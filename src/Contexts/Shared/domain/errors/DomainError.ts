import { AppError } from "./AppError.js";

export abstract class DomainError extends Error implements AppError {
  abstract readonly errorCode: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

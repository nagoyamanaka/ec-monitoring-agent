import { NextFunction, Request, Response } from "express";
import { ApplicationError } from "../../../../../Contexts/Shared/domain/errors/ApplicationError.js";
import { DomainError } from "../../../../../Contexts/Shared/domain/errors/DomainError.js";
import { InfrastructureError } from "../../../../../Contexts/Shared/domain/errors/InfrastructureError.js";
import { OrderResourceNotFoundError } from "../../../../../Contexts/EC/Orders/application/errors/OrderResourceNotFoundError.js";

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof DomainError) {
    res.status(400).json({ type: "domain", msg: error.message });
    return;
  }
  if (error instanceof ApplicationError) {
    if (error instanceof OrderResourceNotFoundError) {
      res.status(404).json({ type: "not_found", msg: error.message });
      return;
    }
    res.status(400).json({ type: "application", msg: error.message });
    return;
  }
  if (error instanceof InfrastructureError) {
    res.status(500).json({ type: "infrastructure", msg: error.message });
    return;
  }
  res.status(500).json({ type: "server", msg: "Internal server error" });
}

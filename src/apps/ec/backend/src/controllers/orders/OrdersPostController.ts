import { NextFunction, Request, Response } from "express";
import { CommandBus } from "../../../../../../Contexts/Shared/domain/CommandBus.js";
import { PlaceOrderCommand } from "../../../../../../Contexts/EC/Orders/application/PlaceOrder/PlaceOrderCommand.js";

export class OrdersPostController {
  constructor(private readonly commandBus: CommandBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId, customerId, items } = req.body;
      const command = new PlaceOrderCommand(orderId ?? crypto.randomUUID(), customerId, items);
      await this.commandBus.dispatch(command);
      res.status(201).json({ orderId: command.orderId });
    } catch (error) {
      next(error);
    }
  }
}

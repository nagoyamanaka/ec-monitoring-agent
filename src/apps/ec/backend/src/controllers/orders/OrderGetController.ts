import { NextFunction, Request, Response } from "express";
import { QueryBus } from "../../../../../../Contexts/Shared/domain/QueryBus.js";
import { GetOrderQuery } from "../../../../../../Contexts/EC/Orders/application/GetOrder/GetOrderQuery.js";

export class OrderGetController {
  constructor(private readonly queryBus: QueryBus) {}

  async run(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const response = await this.queryBus.ask(new GetOrderQuery(req.params.orderId));
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { OrdersPostController } from "../controllers/orders/OrdersPostController.js";
import { OrderGetController } from "../controllers/orders/OrderGetController.js";

export function registerOrderRoutes(router: Router, commandBus: CommandBus, queryBus: QueryBus): void {
  const postController = new OrdersPostController(commandBus);
  const getController = new OrderGetController(queryBus);
  router.post("/orders", postController.run.bind(postController));
  router.get("/orders/:orderId", getController.run.bind(getController));
}

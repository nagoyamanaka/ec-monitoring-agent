import { Router } from "express";
import { CommandBus } from "../../../../../Contexts/Shared/domain/CommandBus.js";
import { QueryBus } from "../../../../../Contexts/Shared/domain/QueryBus.js";
import { PaymentMockOrderGateway } from "../../../../../Contexts/EC/Orders/infrastructure/PaymentMockOrderGateway.js";
import { registerOrderRoutes } from "./orders.route.js";
import { registerDemoRoutes } from "./demo.route.js";

export function registerRoutes(
  router: Router,
  commandBus: CommandBus,
  queryBus: QueryBus,
  paymentGateway: PaymentMockOrderGateway,
): void {
  registerOrderRoutes(router, commandBus, queryBus);
  registerDemoRoutes(router, paymentGateway);
}

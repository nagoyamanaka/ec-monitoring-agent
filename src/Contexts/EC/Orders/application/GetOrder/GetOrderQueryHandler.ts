import { QueryHandler } from "../../../../Shared/domain/QueryHandler.js";
import { OrderId } from "../../domain/OrderId.js";
import { OrderResponse } from "../OrderResponse.js";
import { GetOrderQuery } from "./GetOrderQuery.js";
import { GetOrderUseCase } from "./GetOrderUseCase.js";

export class GetOrderQueryHandler
  implements QueryHandler<GetOrderQuery, OrderResponse>
{
  constructor(private readonly getOrderUseCase: GetOrderUseCase) {}

  subscribedTo() {
    return GetOrderQuery;
  }

  async handle(query: GetOrderQuery): Promise<OrderResponse> {
    const id = new OrderId(query.orderId);
    return this.getOrderUseCase.run(id);
  }
}

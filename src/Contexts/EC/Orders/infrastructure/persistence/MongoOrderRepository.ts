import { OrderRepository } from "../../domain/OrderRepository.js";
import { Order } from "../../domain/Order.js";
import { OrderId } from "../../domain/OrderId.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";

// TODO(Step3): Implement using mongodb driver + MongoCriteriaConverter
export class MongoOrderRepository implements OrderRepository {
  async save(_order: Order): Promise<void> {
    throw new Error("Not implemented");
  }

  async findById(_id: OrderId): Promise<Order | null> {
    throw new Error("Not implemented");
  }

  async findByCriteria(_criteria: Criteria): Promise<Order[]> {
    throw new Error("Not implemented");
  }
}

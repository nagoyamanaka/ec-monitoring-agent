import { Order } from "./Order.js";
import { OrderId } from "./OrderId.js";
import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCriteria(criteria: Criteria): Promise<Order[]>;
}

// @ts-nocheck
import { MongoClient } from "mongodb";
import { MongoRepository } from "../../../../Shared/infrastructure/persistence/mongo/MongoRepository.js";
import { Order } from "../../domain/Order.js";
import { OrderId } from "../../domain/OrderId.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { OrderRepository } from "../../domain/OrderRepository.js";

export class MongoOrderRepository
  extends MongoRepository<Order>
  implements OrderRepository
{
  protected collectionName(): string {
    return "orders";
  }

  async save(order: Order): Promise<void> {
    await this.persist(order.id.value, order);
  }

  async findById(orderId: OrderId): Promise<Order | null> {
    const doc = await this.collection().findOne({ _id: orderId.value });
    if (!doc) return null;

    const { _id, ...rest } = doc;
    return Order.fromPrimitives({ id: _id, ...rest });
  }

  async findByCriteria(criteria: Criteria): Promise<Order[]> {
    const docs = await this.searchByCriteria<Record<string, unknown>>(criteria);
    return docs.map(({ _id, ...rest }) => Order.fromPrimitives({ id: _id, ...rest }));
  }
}

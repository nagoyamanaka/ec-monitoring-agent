import { Filter, Document } from "mongodb";
import { MongoRepository } from "../../../../Shared/infrastructure/persistence/mongo/MongoRepository.js";
import { Order } from "../../domain/Order.js";
import { OrderId } from "../../domain/OrderId.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { OrderRepository } from "../../domain/OrderRepository.js";

type OrderDoc = { _id: string } & Record<string, unknown>;

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
    const doc = await this.collection().findOne(
      { _id: orderId.value } as unknown as Filter<Document>,
    );
    if (!doc) return null;

    const { _id, ...rest } = doc as unknown as OrderDoc;
    return Order.fromPrimitives({ id: _id, ...rest } as Parameters<typeof Order.fromPrimitives>[0]);
  }

  async findByCriteria(criteria: Criteria): Promise<Order[]> {
    const docs = await this.searchByCriteria<OrderDoc>(criteria);
    return docs.map(({ _id, ...rest }) =>
      Order.fromPrimitives({ id: _id, ...rest } as Parameters<typeof Order.fromPrimitives>[0]),
    );
  }
}

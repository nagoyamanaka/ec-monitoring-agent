import { Order } from "../../domain/Order.js";
import { OrderId } from "../../domain/OrderId.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { OrderRepository } from "../../domain/OrderRepository.js";
import { InMemoryCriteriaEvaluator } from "@shared/infrastructure/persistence/InMemoryCriteriaEvaluator.js";

export class InMemoryOrderRepository implements OrderRepository {
  private readonly store = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.store.set(order.id.value, order);
  }

  async findById(id: OrderId): Promise<Order | null> {
    return this.store.get(id.value) ?? null;
  }

  async findByCriteria(criteria: Criteria): Promise<Order[]> {
    return InMemoryCriteriaEvaluator.apply(
      Array.from(this.store.values()),
      criteria,
      (order) => order.toPrimitives() as Record<string, unknown>,
    );
  }

  clear(): void {
    this.store.clear();
  }
}

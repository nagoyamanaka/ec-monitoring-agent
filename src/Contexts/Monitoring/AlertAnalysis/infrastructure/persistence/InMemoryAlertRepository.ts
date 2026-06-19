import { Alert } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";
import { InMemoryCriteriaEvaluator } from "../../../../Shared/infrastructure/persistence/InMemoryCriteriaEvaluator.js";

export class InMemoryAlertRepository implements AlertRepository {
  private readonly store = new Map<string, Alert>();

  async save(alert: Alert): Promise<void> {
    this.store.set(alert.id.value, alert);
  }

  async findById(id: AlertId): Promise<Alert | null> {
    return this.store.get(id.value) ?? null;
  }

  async findByCriteria(criteria: Criteria): Promise<Alert[]> {
    return InMemoryCriteriaEvaluator.apply(
      Array.from(this.store.values()),
      criteria,
      (alert) => alert.toPrimitives() as Record<string, unknown>,
    );
  }

  clear(): void {
    this.store.clear();
  }
}

import { Document, Filter } from "mongodb";
import { MongoRepository } from "../../../../Shared/infrastructure/persistence/mongo/MongoRepository.js";
import { Alert, AlertPrimitives } from "../../domain/Alert.js";
import { AlertId } from "../../domain/AlertId.js";
import { AlertRepository } from "../../domain/AlertRepository.js";
import { Criteria } from "../../../../Shared/domain/criteria/Criteria.js";

type AlertDoc = { _id: string } & Record<string, unknown>;

export class MongoAlertRepository
  extends MongoRepository<Alert>
  implements AlertRepository
{
  protected collectionName(): string {
    return "alerts";
  }

  async save(alert: Alert): Promise<void> {
    await this.persist(alert.id.value, alert);
  }

  async findById(id: AlertId): Promise<Alert | null> {
    const doc = await this.collection().findOne(
      { _id: id.value } as unknown as Filter<Document>,
    );
    if (!doc) return null;

    const { _id, ...rest } = doc as unknown as AlertDoc;
    return Alert.fromPrimitives({ id: _id, ...rest } as AlertPrimitives);
  }

  async findByCriteria(criteria: Criteria): Promise<Alert[]> {
    const docs = await this.searchByCriteria<AlertDoc>(criteria);
    return docs.map(({ _id, ...rest }) =>
      Alert.fromPrimitives({ id: _id, ...rest } as AlertPrimitives),
    );
  }
}

// @ts-nocheck
import { Collection, MongoClient } from "mongodb";
import { AggregateRoot } from "../../../domain/AggregateRoot.js";
import { Criteria } from "../../../domain/criteria/Criteria.js";
import { MongoCriteriaConverter } from "./MongoCriteriaConverter.js";

export abstract class MongoRepository<T extends AggregateRoot> {
  private readonly criteriaConverter = new MongoCriteriaConverter();

  constructor(private readonly _client: MongoClient) {}

  protected abstract collectionName(): string;

  protected collection(): Collection {
    return this._client.db().collection(this.collectionName());
  }

  protected async persist(id: string, aggregateRoot: T): Promise<void> {
    const document = { ...aggregateRoot.toPrimitives(), _id: id, id: undefined };
    await this.collection().updateOne({ _id: id }, { $set: document }, { upsert: true });
  }

  protected async searchByCriteria<D>(criteria: Criteria): Promise<D[]> {
    const { filter, sort, skip, limit } = this.criteriaConverter.convert(criteria);
    return this.collection().find(filter).sort(sort).skip(skip).limit(limit).toArray();
  }
}

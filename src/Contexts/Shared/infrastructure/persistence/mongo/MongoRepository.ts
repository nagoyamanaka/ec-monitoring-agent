import { Collection, Document, Filter, MongoClient } from "mongodb";
import { AggregateRoot } from "../../../domain/AggregateRoot.js";
import { Criteria } from "../../../domain/criteria/Criteria.js";
import { MongoCriteriaConverter } from "./MongoCriteriaConverter.js";

export abstract class MongoRepository<T extends AggregateRoot> {
  private readonly criteriaConverter = new MongoCriteriaConverter();

  constructor(private readonly _client: MongoClient) {}

  protected abstract collectionName(): string;

  protected collection(): Collection<Document> {
    return this._client.db().collection(this.collectionName());
  }

  protected async persist(id: string, aggregateRoot: T): Promise<void> {
    const primitives = aggregateRoot.toPrimitives() as Record<string, unknown>;
    const document = { ...primitives, _id: id, id: undefined };
    await this.collection().updateOne(
      { _id: id } as unknown as Filter<Document>,
      { $set: document },
      { upsert: true },
    );
  }

  protected async searchByCriteria<D>(criteria: Criteria): Promise<D[]> {
    const { filter, sort, skip, limit } = this.criteriaConverter.convert(criteria);
    const docs = await this.collection()
      .find(filter as unknown as Filter<Document>)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
    return docs as unknown as D[];
  }
}

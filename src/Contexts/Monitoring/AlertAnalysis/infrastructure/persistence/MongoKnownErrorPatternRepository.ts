import { Document, Filter } from "mongodb";
import { MongoRepository } from "../../../../Shared/infrastructure/persistence/mongo/MongoRepository.js";
import {
  KnownErrorPattern,
  KnownErrorPatternPrimitives,
} from "../../domain/KnownErrorPattern.js";
import { KnownErrorPatternRepository } from "../../domain/KnownErrorPatternRepository.js";

type PatternDoc = { _id: string } & Record<string, unknown>;

export class MongoKnownErrorPatternRepository
  extends MongoRepository<KnownErrorPattern>
  implements KnownErrorPatternRepository
{
  protected collectionName(): string {
    return "known_error_patterns";
  }

  async save(pattern: KnownErrorPattern): Promise<void> {
    await this.persist(pattern.id, pattern);
  }

  async findById(id: string): Promise<KnownErrorPattern | null> {
    const doc = await this.collection().findOne(
      { _id: id } as unknown as Filter<Document>,
    );
    if (!doc) return null;

    const { _id, ...rest } = doc as unknown as PatternDoc;
    return KnownErrorPattern.fromPrimitives({
      id: _id,
      ...rest,
    } as KnownErrorPatternPrimitives);
  }

  // createdAt ASC: シードの登録順がそのままマッチング優先度になる
  async findAll(): Promise<KnownErrorPattern[]> {
    const docs = await this.collection()
      .find({})
      .sort({ createdAt: 1 })
      .toArray();
    return docs.map(({ _id, ...rest }) =>
      KnownErrorPattern.fromPrimitives({
        id: String(_id),
        ...rest,
      } as KnownErrorPatternPrimitives),
    );
  }
}

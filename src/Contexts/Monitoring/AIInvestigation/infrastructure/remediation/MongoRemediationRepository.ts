import { Collection, Document, Filter, MongoClient } from "mongodb";
import { RemediationRecord } from "../../Remediation/domain/RemediationRecord.js";
import { RemediationRepository } from "../../Remediation/domain/RemediationRepository.js";

type RemediationDoc = {
  _id: string;
  status: RemediationRecord["status"];
  pullRequestUrl: string | null;
  vulnerabilityCount: number;
  reason: string | null;
  createdAt: string;
};

// RemediationRecord は AggregateRoot ではない（独立した小さなライフサイクル状態）ため
// MongoRepository 基底は使わず、alertId を _id にして upsert する素の実装にする。
export class MongoRemediationRepository implements RemediationRepository {
  constructor(private readonly client: MongoClient) {}

  private collection(): Collection<Document> {
    return this.client.db().collection("remediations");
  }

  async save(record: RemediationRecord): Promise<void> {
    const doc: RemediationDoc = {
      _id: record.alertId,
      status: record.status,
      pullRequestUrl: record.pullRequestUrl,
      vulnerabilityCount: record.vulnerabilityCount,
      reason: record.reason,
      createdAt: record.createdAt.toISOString(),
    };
    await this.collection().updateOne(
      { _id: record.alertId } as unknown as Filter<Document>,
      { $set: doc },
      { upsert: true },
    );
  }

  async findByAlertId(alertId: string): Promise<RemediationRecord | null> {
    const doc = await this.collection().findOne(
      { _id: alertId } as unknown as Filter<Document>,
    );
    if (!doc) return null;

    const d = doc as unknown as RemediationDoc;
    return {
      alertId: d._id,
      status: d.status,
      pullRequestUrl: d.pullRequestUrl ?? null,
      vulnerabilityCount: d.vulnerabilityCount ?? 0,
      reason: d.reason ?? null,
      createdAt: new Date(d.createdAt),
    };
  }
}

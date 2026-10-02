import { Collection, MongoClient, MongoServerError } from "mongodb";
import { EvidenceSnapshot, EvidenceSnapshotRepository } from "../domain/EvidenceSnapshot.js";

type EvidenceSnapshotDoc = {
  _id: string; // snapshotId（内容の sha256）
  capturedAt: string; // UTC ISO
  content: string; // 正準化済み JSON（オブジェクトにせず文字列で持つ＝読み戻したバイト列がそのままハッシュ入力）
  sizeBytes: number; // 保存量の見積り用
};

// 追記専用（台帳と同じ）。update/replace/delete を型から外す。
type InsertOnlyCollection = Pick<Collection<EvidenceSnapshotDoc>, "insertOne" | "findOne">;

const DUPLICATE_KEY = 11000;

/**
 * 証拠スナップショットの Mongo 永続化（T0-2）。_id＝snapshotId の内容アドレス。
 * 同じ入力は同じ _id になるので、2回目以降の保存は重複キーを無視して最初の capturedAt を残す。
 * demo reset の対象にしない（台帳の evidenceSnapshotId の参照先＝測定の標本の一部）。
 */
export class MongoEvidenceSnapshotRepository implements EvidenceSnapshotRepository {
  constructor(private readonly client: MongoClient) {}

  private collection(): InsertOnlyCollection {
    return this.client.db().collection<EvidenceSnapshotDoc>("evidence_snapshots");
  }

  async save(snapshot: EvidenceSnapshot): Promise<void> {
    try {
      await this.collection().insertOne({
        _id: snapshot.snapshotId,
        capturedAt: snapshot.capturedAt.toISOString(),
        content: snapshot.content,
        sizeBytes: Buffer.byteLength(snapshot.content, "utf8"),
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) return;
      throw error;
    }
  }

  async findById(snapshotId: string): Promise<EvidenceSnapshot | null> {
    const doc = await this.collection().findOne({ _id: snapshotId });
    if (!doc) return null;
    return { snapshotId: doc._id, capturedAt: new Date(doc.capturedAt), content: doc.content };
  }
}

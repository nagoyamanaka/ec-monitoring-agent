import { RemediationRecord } from "../../domain/remediation/RemediationRecord.js";
import { RemediationRepository } from "../../domain/remediation/RemediationRepository.js";

// MongoRemediationRepository と同じ意味論（alertId で upsert・最新1件のみ保持）を
// メモリ上で再現する。UT のフェイク差し替えと、将来の結合テスト（外部だけモックして
// backend↔context を通す）の両方で本物の RemediationRepository 実装として使う。
export class InMemoryRemediationRepository implements RemediationRepository {
  private readonly store = new Map<string, RemediationRecord>();

  async save(record: RemediationRecord): Promise<void> {
    this.store.set(record.alertId, record);
  }

  async findByAlertId(alertId: string): Promise<RemediationRecord | null> {
    return this.store.get(alertId) ?? null;
  }

  clear(): void {
    this.store.clear();
  }
}

import { RemediationRecord } from "./RemediationRecord.js";

// アラート別のリメディエーション結果を1件保持する（alertId で upsert）。
// 起票は再実行されうるので最新の1件のみを保持し、履歴は持たない（YAGNI）。
export interface RemediationRepository {
  save(record: RemediationRecord): Promise<void>;
  findByAlertId(alertId: string): Promise<RemediationRecord | null>;
}

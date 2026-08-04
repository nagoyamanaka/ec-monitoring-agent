import { RemediationRecord } from "./RemediationRecord.js";

// アラート別のリメディエーション結果を1件保持する（alertId で upsert）。
// 起票は再実行されうるので最新の1件のみを保持し、履歴は持たない（YAGNI）。
export interface RemediationRepository {
  save(record: RemediationRecord): Promise<void>;
  findByAlertId(alertId: string): Promise<RemediationRecord | null>;
  /**
   * before より前に受け付けたまま dispatched で残っている record。
   * 期限切れ処理（ExpireStaleRemediations）専用の走査で、絞り込みは記憶側に持たせる
   * （全件読んでアプリで捨てる形にしない）。
   */
  findStaleDispatched(before: Date): Promise<RemediationRecord[]>;
}

import type { RemediationRecord, RemediationStatus } from "../remediation/RemediationRecord.js";

/**
 * リメディエーションのシリアライズ契約（ワイヤ形式）。
 * GET /alerts/:id/remediation のレスポンス＝SSE remediation イベントの payload＝frontend が受信する JSON、
 * の単一ソース。ランタイム依存ゼロ（純粋な型）＋ record→primitives の純関数のみ。
 *
 * 未起票（record 無し）は "none"。フロントはこの1値でボタン活性/表示状態を判断できる。
 */
export type RemediationResponseStatus = RemediationStatus | "none";

export type RemediationResponsePrimitives = {
  readonly alertId: string;
  readonly status: RemediationResponseStatus;
  readonly pullRequestUrl: string | null;
  readonly vulnerabilityCount: number;
  readonly reason: string | null;
  readonly createdAt: string | null;
};

export function remediationRecordToPrimitives(
  alertId: string,
  record: RemediationRecord | null,
): RemediationResponsePrimitives {
  return {
    alertId,
    status: record?.status ?? "none",
    pullRequestUrl: record?.pullRequestUrl ?? null,
    vulnerabilityCount: record?.vulnerabilityCount ?? 0,
    reason: record?.reason ?? null,
    createdAt: record ? record.createdAt.toISOString() : null,
  };
}

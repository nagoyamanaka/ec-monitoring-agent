import { Response } from "../../../../Shared/domain/Response.js";
import { RemediationRecord } from "../../domain/remediation/RemediationRecord.js";

// 未起票（record 無し）は "none"。フロントはこの1値でボタン活性/ポーリングを判断できる。
export type RemediationViewStatus = RemediationRecord["status"] | "none";

export class RemediationResponse implements Response {
  readonly alertId: string;
  readonly status: RemediationViewStatus;
  readonly pullRequestUrl: string | null;
  readonly vulnerabilityCount: number;
  readonly reason: string | null;
  readonly createdAt: string | null;

  constructor(alertId: string, record: RemediationRecord | null) {
    this.alertId = alertId;
    this.status = record?.status ?? "none";
    this.pullRequestUrl = record?.pullRequestUrl ?? null;
    this.vulnerabilityCount = record?.vulnerabilityCount ?? 0;
    this.reason = record?.reason ?? null;
    this.createdAt = record ? record.createdAt.toISOString() : null;
  }
}

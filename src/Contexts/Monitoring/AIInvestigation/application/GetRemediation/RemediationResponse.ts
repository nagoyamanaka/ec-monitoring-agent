import { Response } from "../../../../Shared/domain/Response.js";
import { RemediationRecord } from "../../domain/remediation/RemediationRecord.js";
import {
  RemediationResponsePrimitives,
  RemediationResponseStatus,
  remediationRecordToPrimitives,
} from "../../domain/contracts/RemediationContract.js";

// 後方互換の再エクスポート（旧称）。新規参照は RemediationContract を直接使う。
export type RemediationViewStatus = RemediationResponseStatus;

// res.json(response) でフラットに直列化される。フィールドは RemediationResponsePrimitives と一致させる
// （契約の単一ソース＝remediationRecordToPrimitives 経由で構築し、SSE push と同形を保証する）。
export class RemediationResponse
  implements Response, RemediationResponsePrimitives
{
  readonly alertId: string;
  readonly status: RemediationResponseStatus;
  readonly pullRequestUrl: string | null;
  readonly vulnerabilityCount: number;
  readonly reason: string | null;
  readonly createdAt: string | null;

  constructor(alertId: string, record: RemediationRecord | null) {
    const p = remediationRecordToPrimitives(alertId, record);
    this.alertId = p.alertId;
    this.status = p.status;
    this.pullRequestUrl = p.pullRequestUrl;
    this.vulnerabilityCount = p.vulnerabilityCount;
    this.reason = p.reason;
    this.createdAt = p.createdAt;
  }
}

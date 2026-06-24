import type { HttpClient } from "@shared/api/HttpClient";
import {
  type RemediationResponseWire,
  type RemediationView,
  toRemediationView,
} from "../domain/RemediationView";

/**
 * リメディエーションの REST アクセス。HttpClient interface にのみ依存し、テストはモックに差し替える。
 * エンドポイント:
 * - GET  /alerts/:id/remediation         … 現在の起票状態を読む（CQRS の read 側）
 * - POST /alerts/:id/remediation/draft-pr … 起票トリガー（人間の承認アクション・202 受付のみ）
 * 受信した wire を domain の純関数で RemediationView へ写像する。
 */
export interface RemediationApi {
  getRemediation(id: string, signal?: AbortSignal): Promise<RemediationView>;
  /** 起票を依頼する。結果（PR URL 等）は getRemediation で読む（202 受付のみ返る）。 */
  draftRemediation(id: string, signal?: AbortSignal): Promise<void>;
}

export function createRemediationApi(http: HttpClient): RemediationApi {
  return {
    async getRemediation(id, signal) {
      const wire = await http.get<RemediationResponseWire>(
        `/alerts/${encodeURIComponent(id)}/remediation`,
        { signal },
      );
      return toRemediationView(wire);
    },

    async draftRemediation(id, signal) {
      await http.post<unknown>(
        `/alerts/${encodeURIComponent(id)}/remediation/draft-pr`,
        undefined,
        { signal },
      );
    },
  };
}

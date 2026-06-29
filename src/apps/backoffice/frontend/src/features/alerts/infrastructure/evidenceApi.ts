import type { InfraEvidencePrimitives } from "@monitoring/AIInvestigation/domain/contracts/InfraEvidenceContract";
import type { HttpClient } from "@shared/api/HttpClient";
import { type EvidenceView, toEvidenceView } from "../domain/EvidenceView";

/**
 * インフラ証拠の REST アクセス。HttpClient interface にのみ依存し、テストはモックに差し替える。
 * エンドポイント: GET /alerts/:id/evidence（証拠）。
 * 調査の完了判定は SSE で更新される alert.status から導出するため、status のポーリング API は持たない。
 * 受信した InfraEvidencePrimitives（共有ワイヤ契約）を domain の純関数で EvidenceView へ写像する。
 */
export interface EvidenceApi {
  getEvidence(id: string, signal?: AbortSignal): Promise<EvidenceView>;
}

export function createEvidenceApi(http: HttpClient): EvidenceApi {
  return {
    async getEvidence(id, signal) {
      const primitives = await http.get<InfraEvidencePrimitives>(
        `/alerts/${encodeURIComponent(id)}/evidence`,
        { signal },
      );
      return toEvidenceView(primitives);
    },
  };
}

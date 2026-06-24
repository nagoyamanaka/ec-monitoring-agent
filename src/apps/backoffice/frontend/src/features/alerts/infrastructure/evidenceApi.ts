import type { InfraEvidencePrimitives } from "@monitoring/AIInvestigation/domain/InfraEvidence";
import type { HttpClient } from "@shared/api/HttpClient";
import {
  type EvidenceView,
  type InvestigationStatus,
  toEvidenceView,
} from "../domain/EvidenceView";

/**
 * インフラ証拠の REST アクセス。HttpClient interface にのみ依存し、テストはモックに差し替える。
 * エンドポイント: GET /alerts/:id/evidence（証拠）/ GET /alerts/:id/investigation/status（段階ポーリング）。
 * 受信した InfraEvidencePrimitives（共有ワイヤ契約）を domain の純関数で EvidenceView へ写像する。
 */

/** GET /alerts/:id/investigation/status の wire 形状。 */
type InvestigationStatusWire = {
  readonly alertId: string;
  readonly status: InvestigationStatus;
};

export type InvestigationStatusResult = {
  readonly alertId: string;
  readonly status: InvestigationStatus;
};

export interface EvidenceApi {
  getEvidence(id: string, signal?: AbortSignal): Promise<EvidenceView>;
  getInvestigationStatus(
    id: string,
    signal?: AbortSignal,
  ): Promise<InvestigationStatusResult>;
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

    async getInvestigationStatus(id, signal) {
      const res = await http.get<InvestigationStatusWire>(
        `/alerts/${encodeURIComponent(id)}/investigation/status`,
        { signal },
      );
      return { alertId: res.alertId, status: res.status };
    },
  };
}

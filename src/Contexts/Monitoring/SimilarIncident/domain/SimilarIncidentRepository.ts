import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";
import { SimilarIncident } from "./SimilarIncident.js";

// インデックス登録用（正解フィードバック時に解決済みインシデントとして登録する）
export type ResolvedIncident = {
  readonly eventName: string;
  readonly occurredOn: Date;
  readonly resolvedNote: string;
};

export interface SimilarIncidentRepository {
  findSimilar(criteria: Criteria): Promise<SimilarIncident[]>;
  index(incident: ResolvedIncident): Promise<void>;
}

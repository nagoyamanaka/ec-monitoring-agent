import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";
import { InMemoryCriteriaEvaluator } from "../../../Shared/infrastructure/persistence/InMemoryCriteriaEvaluator.js";
import {
  ResolvedIncident,
  ScoredIncident,
  SimilarIncidentRepository,
  SimilarSearchQuery,
} from "../domain/SimilarIncidentRepository.js";
import { SimilarIncident } from "../domain/SimilarIncident.js";

const MAX_INCIDENTS = 100;

export class InMemorySimilarIncidentRepository implements SimilarIncidentRepository {
  private incidents: SimilarIncident[] = [];
  private nextId = 1;

  // 起動時に MongoDB の解決済みインシデントでウォームアップする
  async warmUp(mongoIncidents: SimilarIncident[]): Promise<void> {
    this.incidents = [...mongoIncidents].slice(0, MAX_INCIDENTS);
  }

  async findSimilar(criteria: Criteria): Promise<SimilarIncident[]> {
    return InMemoryCriteriaEvaluator.apply(
      this.incidents,
      criteria,
      (incident) => ({
        id: incident.id,
        eventName: incident.eventName,
        occurredOn: incident.occurredOn.toISOString(),
        resolvedNote: incident.resolvedNote,
        resolvedAt: incident.resolvedAt.toISOString(),
      }),
    );
  }

  async index(incident: ResolvedIncident): Promise<void> {
    const entry: SimilarIncident = {
      id: String(this.nextId++),
      eventName: incident.eventName,
      occurredOn: incident.occurredOn,
      resolvedNote: incident.resolvedNote,
      resolvedAt: new Date(),
      severity: incident.severity,
      sourceAlertId: incident.sourceAlertId,
    };
    this.incidents.unshift(entry); // 最新を先頭に
    if (this.incidents.length > MAX_INCIDENTS) {
      this.incidents.pop();
    }
  }

  // Elastic 無しでも graded confidence 分類を回すための字句類似スコアリング（Jaccard, [0,1]）。
  // Elastic の生 BM25 と違い既に [0,1] 正規化済みなので SimilarPatternRule の scoreCeiling 既定 1 と整合する。
  async search(query: SimilarSearchQuery): Promise<ScoredIncident[]> {
    const queryTokens = tokenize(query.text);
    return this.incidents
      .map((incident) => ({
        incident,
        score: jaccard(queryTokens, tokenize(documentText(incident))),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit);
  }
}

function documentText(incident: SimilarIncident): string {
  return `${incident.eventName} ${incident.resolvedNote}`;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/i)
      .filter((token) => token.length > 0),
  );
}

// Jaccard 係数: |A∩B| / |A∪B| ∈ [0,1]
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";
import { InMemoryCriteriaEvaluator } from "../../../Shared/infrastructure/persistence/InMemoryCriteriaEvaluator.js";
import {
  ResolvedIncident,
  ScoredIncident,
  SimilarIncidentRepository,
  SimilarSearchQuery,
} from "../domain/SimilarIncidentRepository.js";
import { SimilarIncident } from "../domain/SimilarIncident.js";
import { lexicalSimilarity } from "../domain/lexicalSimilarity.js";

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

  // 指定 Alert 由来の解決済みインシデントを全削除する（承認の撤回で学習を残さない）。
  async removeByAlertId(sourceAlertId: string): Promise<void> {
    this.incidents = this.incidents.filter(
      (incident) => incident.sourceAlertId !== sourceAlertId,
    );
  }

  // graded confidence 分類用の字句類似スコアリング（lexicalSimilarity = Jaccard, [0,1]）。
  // Elastic 版と同一の有界指標を使うことで、backend を変えても score の意味が一致する。
  async search(query: SimilarSearchQuery): Promise<ScoredIncident[]> {
    return this.incidents
      .map((incident) => ({
        incident,
        score: lexicalSimilarity(query.text, documentText(incident)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit);
  }
}

function documentText(incident: SimilarIncident): string {
  return `${incident.eventName} ${incident.resolvedNote}`;
}

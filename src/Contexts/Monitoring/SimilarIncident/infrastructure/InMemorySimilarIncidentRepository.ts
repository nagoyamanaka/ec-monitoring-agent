import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";
import { InMemoryCriteriaEvaluator } from "../../../Shared/infrastructure/persistence/InMemoryCriteriaEvaluator.js";
import { ResolvedIncident, SimilarIncidentRepository } from "../domain/SimilarIncidentRepository.js";
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
    };
    this.incidents.unshift(entry); // 最新を先頭に
    if (this.incidents.length > MAX_INCIDENTS) {
      this.incidents.pop();
    }
  }
}

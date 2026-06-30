import { Client as ElasticClient } from "@elastic/elasticsearch";
import { Criteria } from "../../../Shared/domain/criteria/Criteria.js";
import { Uuid } from "../../../Shared/domain/value-object/Uuid.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";
import { SimilarIncident } from "../domain/SimilarIncident.js";
import {
  ResolvedIncident,
  ScoredIncident,
  SimilarIncidentRepository,
  SimilarSearchQuery,
} from "../domain/SimilarIncidentRepository.js";
import { lexicalSimilarity } from "../domain/lexicalSimilarity.js";

// similar-incidents インデックスのマッピング。
// eventName は全文検索（fuzzy）と厳密一致（.keyword）の両方に使うので multi-field。
// ElasticClientFactory.createClient に渡してインデックス自動生成に使う。
export const SIMILAR_INCIDENTS_INDEX_CONFIG = {
  mappings: {
    properties: {
      id: { type: "keyword" },
      eventName: {
        type: "text",
        fields: { keyword: { type: "keyword" } },
      },
      occurredOn: { type: "date" },
      resolvedNote: { type: "text" },
      resolvedAt: { type: "date" },
      severity: { type: "keyword" },
      sourceAlertId: { type: "keyword" },
    },
  },
} as const;

type IncidentDoc = {
  id: string;
  eventName: string;
  occurredOn: string;
  resolvedNote: string;
  resolvedAt: string;
  severity: string;
  sourceAlertId?: string;
};

type EsSearchBody<D> = {
  hits: { hits: Array<{ _source: D; _score: number | null }> };
};

// Elasticsearch を実バックエンドにした SimilarIncident 永続＋類似検索。
// findSimilar（件数のみ・AI調査の文脈強化）/ index（追記）/ search（graded confidence 用スコア付き）を同一インデックスで提供する。
// 既存の elasticsearch スキャフォルド（ElasticClientFactory / ElasticConfig）に乗せて接続・インデックス生成する。
export class ElasticSimilarIncidentRepository
  implements SimilarIncidentRepository
{
  constructor(
    private readonly client: Promise<ElasticClient>,
    private readonly indexName: string,
  ) {}

  // 起動時シード（InMemory.warmUp 互換）。ES は永続するため id 指定の冪等 upsert で投入する。
  async warmUp(incidents: SimilarIncident[]): Promise<void> {
    if (incidents.length === 0) return;
    const client = await this.client;
    const operations = incidents.flatMap((incident) => [
      { index: { _index: this.indexName, _id: incident.id } },
      this.toDoc(incident),
    ]);
    await client.bulk({ refresh: true, body: operations });
  }

  // 正解フィードバックを解決済みインシデントとして追記する（resolvedAt=now）。
  async index(incident: ResolvedIncident): Promise<void> {
    const client = await this.client;
    const id = Uuid.random().value;
    const doc: IncidentDoc = {
      id,
      eventName: incident.eventName,
      occurredOn: incident.occurredOn.toISOString(),
      resolvedNote: incident.resolvedNote,
      resolvedAt: new Date().toISOString(),
      severity: incident.severity.value,
      ...(incident.sourceAlertId
        ? { sourceAlertId: incident.sourceAlertId }
        : {}),
    };
    await client.index({ index: this.indexName, id, body: doc, refresh: true });
  }

  // 指定 Alert 由来の解決済みインシデントを撤回する（sourceAlertId 一致を delete_by_query）。
  // 承認のやり直し（承認→却下/取消）で誤った類似学習を残さないために使う。
  async removeByAlertId(sourceAlertId: string): Promise<void> {
    const client = await this.client;
    await client.deleteByQuery({
      index: this.indexName,
      refresh: true,
      body: { query: { term: { sourceAlertId } } },
    });
  }

  // eventName 厳密一致＋resolvedAt 降順で取得（AI調査の文脈強化用・件数のみ）。
  async findSimilar(criteria: Criteria): Promise<SimilarIncident[]> {
    const client = await this.client;
    const eventName = this.extractEventName(criteria);
    const query = eventName
      ? { term: { "eventName.keyword": eventName } }
      : { match_all: {} };

    const response = await client.search<EsSearchBody<IncidentDoc>>({
      index: this.indexName,
      body: {
        size: criteria.limit ?? 100,
        sort: [{ resolvedAt: { order: "desc" } }],
        query,
      },
    });

    return response.body.hits.hits.map((hit) => this.toEntity(hit._source));
  }

  // ハイブリッド検索：候補取得（recall/ランキング）は BM25 の fuzzy multi_match に任せるが、
  // **分類 confidence には backend 非依存で有界な lexicalSimilarity（Jaccard, [0,1]）を使う**。
  // 生 _score は無界でコーパス規模・アナライザに依存し、小コーパスで飽和して「無関係事例に 100% 類似」の
  // 偽 KNOWN を生むため score としては返さない（InMemory と同義の [0,1] に揃える）。
  async search(query: SimilarSearchQuery): Promise<ScoredIncident[]> {
    const client = await this.client;
    const response = await client.search<EsSearchBody<IncidentDoc>>({
      index: this.indexName,
      body: {
        size: query.limit,
        query: {
          multi_match: {
            query: query.text,
            fields: ["eventName^2", "resolvedNote"],
            fuzziness: "AUTO",
          },
        },
      },
    });

    return response.body.hits.hits
      .map((hit) => {
        const incident = this.toEntity(hit._source);
        return {
          incident,
          score: lexicalSimilarity(
            query.text,
            `${incident.eventName} ${incident.resolvedNote}`,
          ),
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private extractEventName(criteria: Criteria): string | null {
    for (const filter of criteria.filters.filters) {
      if (filter.field.value === "eventName") {
        return String(filter.value.value);
      }
    }
    return null;
  }

  private toDoc(incident: SimilarIncident): IncidentDoc {
    return {
      id: incident.id,
      eventName: incident.eventName,
      occurredOn: incident.occurredOn.toISOString(),
      resolvedNote: incident.resolvedNote,
      resolvedAt: incident.resolvedAt.toISOString(),
      severity: incident.severity.value,
      ...(incident.sourceAlertId
        ? { sourceAlertId: incident.sourceAlertId }
        : {}),
    };
  }

  private toEntity(doc: IncidentDoc): SimilarIncident {
    return {
      id: doc.id,
      eventName: doc.eventName,
      occurredOn: new Date(doc.occurredOn),
      resolvedNote: doc.resolvedNote,
      resolvedAt: new Date(doc.resolvedAt),
      severity: AlertSeverity.fromString(doc.severity),
      ...(doc.sourceAlertId ? { sourceAlertId: doc.sourceAlertId } : {}),
    };
  }
}

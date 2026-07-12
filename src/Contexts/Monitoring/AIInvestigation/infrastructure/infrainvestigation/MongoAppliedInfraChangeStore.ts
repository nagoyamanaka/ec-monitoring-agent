import { Collection, Document, Filter, MongoClient } from "mongodb";
import { TerraformResourceChange } from "../../domain/InfraEvidence.js";
import {
  AppliedInfraChange,
  AppliedInfraChangeStore,
} from "./AppliedInfraChangeStore.js";

type AppliedInfraChangeDoc = {
  appliedAt: string; // ISO 8601（UTC 固定幅）。$gte の辞書順比較＝時系列比較が成立する。
  resourceChanges: TerraformResourceChange[];
  commitSha: string | null;
  url: string | null;
  summary: string;
};

// apply イベントの Mongo 永続化。
// record（edge: demo 注入／CI ingest）と findAppliedSince（worker: 調査）は本番で別プロセスに
// 分かれるため、InMemory 版（単一プロセス前提）では調査側に apply が届かず、terraform 証拠が
// evidenceCounts・確信度シグナル（terraform_diff）から常に欠落していた。edge/worker が既に
// 共有している Mongo を SoT にして、どのロール構成でも同じ証拠が引けるようにする。
export class MongoAppliedInfraChangeStore implements AppliedInfraChangeStore {
  constructor(private readonly client: MongoClient) {}

  private collection(): Collection<Document> {
    return this.client.db().collection("applied_infra_changes");
  }

  async record(change: AppliedInfraChange): Promise<void> {
    const doc: AppliedInfraChangeDoc = {
      appliedAt: change.appliedAt.toISOString(),
      resourceChanges: change.resourceChanges,
      commitSha: change.commitSha ?? null,
      url: change.url ?? null,
      summary: change.summary,
    };
    await this.collection().insertOne(doc as Document);
  }

  async findAppliedSince(since: Date): Promise<AppliedInfraChange[]> {
    const docs = await this.collection()
      .find({
        appliedAt: { $gte: since.toISOString() },
      } as unknown as Filter<Document>)
      .sort({ appliedAt: -1 })
      .toArray();

    return docs.map((raw) => {
      const d = raw as unknown as AppliedInfraChangeDoc;
      return {
        appliedAt: new Date(d.appliedAt),
        resourceChanges: d.resourceChanges,
        ...(d.commitSha ? { commitSha: d.commitSha } : {}),
        ...(d.url ? { url: d.url } : {}),
        summary: d.summary,
      };
    });
  }
}

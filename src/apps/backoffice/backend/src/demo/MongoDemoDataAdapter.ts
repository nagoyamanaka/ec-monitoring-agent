import { MongoClient } from "mongodb";
import { AlertReadModelStore } from "../../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/readmodel/AlertReadModelStore.js";
import { DemoDataPort } from "./DemoDataPort.js";

// Mongo のコレクションを直接 deleteMany する demo reset 実装。
// コレクション名は MongoAlertRepository / MongoKnownErrorPatternRepository と一致させる。
export class MongoDemoDataAdapter implements DemoDataPort {
  constructor(
    private readonly client: MongoClient,
    // Valkey read-model 有効時のみ渡る。Mongo 直 delete は read-model を更新しないため、
    // 一覧キャッシュを明示 invalidate しないと reset 後も GET /alerts が古い一覧を返す。
    private readonly readModelStore: AlertReadModelStore | null = null,
  ) {}

  async clearAlerts(): Promise<void> {
    await this.client.db().collection("alerts").deleteMany({});
    // SoT(Mongo) を消したので read-model の一覧スナップショットも無効化する（次回読み取りで空を再構築）。
    // best-effort（Valkey 障害で reset を壊さない）。
    try {
      await this.readModelStore?.invalidateList();
    } catch {
      // no-op: read-model は再構築可能な projection。無効化失敗は性能劣化に留める。
    }
  }

  async clearPatterns(): Promise<void> {
    await this.client.db().collection("known_error_patterns").deleteMany({});
  }

  async clearRemediations(): Promise<void> {
    await this.client.db().collection("remediations").deleteMany({});
  }

  async clearAppliedInfraChanges(): Promise<void> {
    await this.client.db().collection("applied_infra_changes").deleteMany({});
  }
}

import { MongoClient } from "mongodb";
import { DemoDataPort } from "./DemoDataPort.js";

// Mongo のコレクションを直接 deleteMany する demo reset 実装。
// コレクション名は MongoAlertRepository / MongoKnownErrorPatternRepository と一致させる。
export class MongoDemoDataAdapter implements DemoDataPort {
  constructor(private readonly client: MongoClient) {}

  async clearAlerts(): Promise<void> {
    await this.client.db().collection("alerts").deleteMany({});
  }

  async clearPatterns(): Promise<void> {
    await this.client.db().collection("known_error_patterns").deleteMany({});
  }

  async clearRemediations(): Promise<void> {
    await this.client.db().collection("remediations").deleteMany({});
  }
}

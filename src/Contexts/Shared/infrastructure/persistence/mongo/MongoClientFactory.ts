import { MongoClient } from 'mongodb';
import MongoConfig from './MongoConfig.js';

export class MongoClientFactory {
  private static clients: { [key: string]: MongoClient } = {};

  static async createClient(contextName: string, config: MongoConfig): Promise<MongoClient> {
    let client = MongoClientFactory.getClient(contextName);

    if (!client) {
      client = await MongoClientFactory.createAndConnectClient(config);

      MongoClientFactory.registerClient(client, contextName);
    }

    return client;
  }

  private static getClient(contextName: string): MongoClient | null {
    return MongoClientFactory.clients[contextName] ?? null;
  }

  private static async createAndConnectClient(config: MongoConfig): Promise<MongoClient> {
    // コスト最適化のため接続プール上限を明示的にキャップする（driver 既定 maxPoolSize=100 → 40）。
    // ピーク帯の接続枯渇リスクと引き換えのコスト削減のため、負荷試験後に段階適用する。
    const client = new MongoClient(config.url, {
      ignoreUndefined: true,
      maxPoolSize: 40,
    });

    await client.connect();

    return client;
  }

  private static registerClient(client: MongoClient, contextName: string): void {
    MongoClientFactory.clients[contextName] = client;
  }
}

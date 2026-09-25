import { Collection, Document, MongoClient } from "mongodb";
import { ForecastLedgerEvent, ForecastLedgerRepository } from "../domain/ForecastLedger.js";

// 行の Date だけ ISO 文字列にした射影（UTC 固定幅＝辞書順比較が時系列比較になる）。
type ForecastLedgerDoc = Omit<ForecastLedgerEvent, "issuedAt" | "windowEndsAt"> & {
  issuedAt: string;
  windowEndsAt: string;
  recordedAt: string; // 台帳に書いた時刻（issuedAt との差＝記録の遅れ）
};

// 追記専用のコレクション型。update/replace/delete 系のメソッドを型から外し、
// このクラスの中でも既存行を書き換えるコードを書けないようにする（不変条件1）。
type AppendOnlyCollection = Pick<Collection<Document>, "insertOne" | "find" | "createIndex">;

/**
 * 予報台帳の Mongo 永続化（T0-1）。1イベント＝1ドキュメントの insert のみ。
 * issued は forecastId ごとに1行だけ（部分一意インデックス）＝同じ予報を二度発行しない。
 * 決着（T1-1）は同じコレクションに別の eventType で追記する想定なので、一意性は issued に限定する。
 * demo reset の対象にしない（台帳は測定の標本そのもの）。
 */
export class MongoForecastLedgerRepository implements ForecastLedgerRepository {
  private indexReady: Promise<unknown> | null = null;

  constructor(private readonly client: MongoClient) {}

  private collection(): AppendOnlyCollection {
    return this.client.db().collection("forecast_ledger");
  }

  // 初回の書き込み前に1度だけ張る（createIndex は冪等）。失敗したら次回の append で張り直す。
  private ensureIndexes(): Promise<unknown> {
    this.indexReady ??= this.collection()
      .createIndex(
        { forecastId: 1 },
        {
          name: "issued_forecastId_unique",
          unique: true,
          partialFilterExpression: { eventType: "issued" },
        },
      )
      .catch((error: unknown) => {
        this.indexReady = null;
        throw error;
      });
    return this.indexReady;
  }

  async append(event: ForecastLedgerEvent): Promise<void> {
    await this.ensureIndexes();
    const doc: ForecastLedgerDoc = {
      ...event,
      issuedAt: event.issuedAt.toISOString(),
      windowEndsAt: event.windowEndsAt.toISOString(),
      recordedAt: new Date().toISOString(),
    };
    await this.collection().insertOne(doc as unknown as Document);
  }

  async findAll(): Promise<ForecastLedgerEvent[]> {
    const docs = await this.collection().find({}).sort({ issuedAt: 1, _id: 1 }).toArray();
    return docs.map((raw) => {
      const { _id, recordedAt, issuedAt, windowEndsAt, ...event } =
        raw as unknown as ForecastLedgerDoc & { _id: unknown };
      return { ...event, issuedAt: new Date(issuedAt), windowEndsAt: new Date(windowEndsAt) };
    });
  }
}

import { Collection, Document, Filter, MongoClient } from "mongodb";
import { ForecastBriefing, RiskForecastRepository } from "../domain/ForecastBriefing.js";
import { ForecastSignal } from "../domain/ForecastSignal.js";
import { RiskForecast } from "../domain/RiskForecast.js";

// 予報1回ぶんのドキュメント（＝ ForecastBriefing の射影。Date だけ ISO 文字列にする）。
// `Omit & spread` で組むのは、`RiskForecast` に**追記される**フィールド（検証カウンタ等）が
// マッピングを書き足さなくてもそのまま同じドキュメントに載るようにするため
// ——測定値を別コレクションへ散らさないことが、このストアを作った目的そのもの。
type RiskForecastDoc = Omit<RiskForecast, "generatedAt"> & {
  generatedAt: string; // ISO 8601（UTC 固定幅）。辞書順比較＝時系列比較が成立する。
  // 引用チップの解決先。予報単体では citations が何を指すか解決できないので同梱する。
  signals: ForecastSignal[];
  // DELETE /forecast（未生成状態へ戻す）の soft discard。**行は消さない**＝履歴は残る。
  discardedAt: string | null;
};

/**
 * 予報の Mongo 永続化（生成のたびに1件 insert）。
 *
 * 旧 `InMemoryRiskForecastRepository` は単一プロセスの最新1件しか持たず、帰結が2つあった:
 * (1) Cloud Run edge の再起動・インスタンス増減で予報が消える（生成した個体と GET を受けた
 *     個体が違えば 404）——terraform 証拠が `edge/worker × InMemory` で消えたのと同型の負債。
 * (2) 履歴がゼロなので、level 分布も引用の破棄件数も**後から集計できない**。
 * edge/worker が既に共有している Mongo を SoT にして、どのロール構成でも同じ予報が引ける。
 */
export class MongoRiskForecastRepository implements RiskForecastRepository {
  constructor(private readonly client: MongoClient) {}

  private collection(): Collection<Document> {
    return this.client.db().collection("risk_forecasts");
  }

  async append(briefing: ForecastBriefing): Promise<void> {
    const doc: RiskForecastDoc = {
      ...briefing.forecast,
      generatedAt: briefing.forecast.generatedAt.toISOString(),
      signals: [...briefing.signals],
      discardedAt: null,
    };
    await this.collection().insertOne(doc as unknown as Document);
  }

  async findLatest(): Promise<ForecastBriefing | null> {
    // `_id` の第2ソートは同一 generatedAt（fallback や決定論 fake が同じ時刻を返す場合）の
    // タイブレーク＝「後から入れたほうが最新」を挿入順で決める。
    const doc = await this.collection().findOne(
      { discardedAt: null } as unknown as Filter<Document>,
      { sort: { generatedAt: -1, _id: -1 } },
    );
    if (!doc) return null;
    return this.toBriefing(doc);
  }

  // 測定の標本は**破棄済みも含めた全行**（→ RiskForecastRepository.findAll のコメント）。
  // 件数は当面2桁なので全件読みで足りる（ページングを先回りしない）。
  async findAll(): Promise<ForecastBriefing[]> {
    const docs = await this.collection()
      .find({})
      .sort({ generatedAt: 1, _id: 1 })
      .toArray();
    return docs.map((doc) => this.toBriefing(doc));
  }

  async clear(): Promise<void> {
    await this.collection().updateMany(
      { discardedAt: null } as unknown as Filter<Document>,
      { $set: { discardedAt: new Date().toISOString() } },
    );
  }

  // `_id` と永続化専用フィールド（discardedAt）だけを剥がし、
  // 残りは追記フィールドごと forecast へ戻す（読み側にもマッピングの書き足しを要求しない）。
  private toBriefing(raw: Document): ForecastBriefing {
    const { _id, discardedAt, signals, generatedAt, ...forecast } =
      raw as unknown as RiskForecastDoc & { _id: unknown };
    return {
      forecast: { ...forecast, generatedAt: new Date(generatedAt) },
      signals,
    };
  }
}

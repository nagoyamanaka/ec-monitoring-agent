import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoRiskForecastRepository } from "../../../../../Contexts/Monitoring/Forecast/infrastructure/MongoRiskForecastRepository.js";
import { ForecastBriefing } from "../../../../../Contexts/Monitoring/Forecast/domain/ForecastBriefing.js";
import { sharedMongoClient } from "./support.js";

/**
 * MongoRiskForecastRepository の実 Mongo 疎通。
 * 「追記されること（履歴が積まれる）」と「読み取りは最新1件だけ」が両立しているかが対象で、
 * これは InMemory の最新1件保持では**構造上テストできなかった**性質（→ v2 E0）。
 * clear() が soft discard（読み取りから外すが行は残す）であることも、測定の標本が
 * デモ卓のリセットで消えないための本質なのでここで固定する。
 */
const briefing = (forecastId: string, generatedAt: string): ForecastBriefing => ({
  forecast: {
    forecastId,
    generatedAt: new Date(generatedAt),
    horizon: "今週末",
    risks: [
      {
        window: "土 20:00",
        subject: "db.connection_pool",
        level: "HIGH",
        confidence: 0.8,
        citations: ["sch-1"],
        reasoning: "セール負荷とプール縮小が重なるため。",
        preventiveAction: "縮小 plan の適用をセール後へ延期する。",
      },
    ],
    isFallback: false,
  },
  signals: [
    {
      id: "sch-1",
      kind: "SCHEDULE",
      subject: "db.connection_pool",
      when: "土 20:00-23:00",
      desc: "週末セール",
      source: "schedule.seed",
      url: "https://example.com/schedule/1",
    },
  ],
});

describe("MongoRiskForecastRepository (integration)", () => {
  let mongo: MongoClient;
  let store: MongoRiskForecastRepository;

  beforeAll(async () => {
    mongo = await sharedMongoClient();
    await mongo.db().collection("risk_forecasts").deleteMany({});
    store = new MongoRiskForecastRepository(mongo);
  });

  afterAll(async () => {
    await mongo?.close();
  });

  it("生成前は null（未生成＝ GET /forecast の 404 の素）", async () => {
    expect(await store.findLatest()).toBeNull();
  });

  it("append は上書きせず1件ずつ積み、findLatest は最新だけを返す", async () => {
    await store.append(briefing("f-1", "2026-08-01T00:00:00.000Z"));
    await store.append(briefing("f-2", "2026-08-02T00:00:00.000Z"));

    const latest = await store.findLatest();
    expect(latest?.forecast.forecastId).toBe("f-2");
    expect(await mongo.db().collection("risk_forecasts").countDocuments({})).toBe(2);
  });

  it("generatedAt が同一でも、後から追記したほうが最新になる", async () => {
    await store.append(briefing("f-3", "2026-08-02T00:00:00.000Z"));

    const latest = await store.findLatest();
    expect(latest?.forecast.forecastId).toBe("f-3");
  });

  it("Date・任意項目（preventiveAction / url）がラウンドトリップする", async () => {
    const latest = await store.findLatest();

    expect(latest?.forecast.generatedAt).toBeInstanceOf(Date);
    expect(latest?.forecast.generatedAt.toISOString()).toBe("2026-08-02T00:00:00.000Z");
    expect(latest?.forecast.risks[0].preventiveAction).toBe(
      "縮小 plan の適用をセール後へ延期する。",
    );
    expect(latest?.forecast.isFallback).toBe(false);
    expect(latest?.signals[0]).toEqual(
      expect.objectContaining({ id: "sch-1", kind: "SCHEDULE", url: "https://example.com/schedule/1" }),
    );
  });

  it("clear は未生成状態に戻すが、履歴（行）は残す", async () => {
    await store.clear();

    expect(await store.findLatest()).toBeNull();
    // 測定の標本はここに残っている＝デモ卓のリセットで level 分布が消えない。
    expect(await mongo.db().collection("risk_forecasts").countDocuments({})).toBe(3);
  });

  it("clear の後に生成した予報は再び最新として読める", async () => {
    await store.append(briefing("f-4", "2026-08-03T00:00:00.000Z"));

    expect((await store.findLatest())?.forecast.forecastId).toBe("f-4");
    expect(await mongo.db().collection("risk_forecasts").countDocuments({})).toBe(4);
  });

  it("findAll は破棄済みも含めた全件を古い順で返す（測定の標本＝ E6）", async () => {
    const all = await store.findAll();

    // f-1〜f-3 は clear() で破棄済みだが標本には残る（リセットで level 分布が消えない）
    expect(all.map((b) => b.forecast.forecastId)).toEqual(["f-1", "f-2", "f-3", "f-4"]);
    expect(await store.findLatest()).not.toBeNull(); // 配信は最新1件のまま
  });

  it("検証カウンタ（追記フィールド）がマッピング追加なしでラウンドトリップする", async () => {
    const withStats = briefing("f-5", "2026-08-04T00:00:00.000Z");
    await store.append({
      ...withStats,
      forecast: {
        ...withStats.forecast,
        verification: {
          citationsEmitted: 3,
          citationsDropped: 1,
          risksEmitted: 2,
          risksDropped: 1,
        },
      },
    });

    const latest = await store.findLatest();
    expect(latest?.forecast.verification).toEqual({
      citationsEmitted: 3,
      citationsDropped: 1,
      risksEmitted: 2,
      risksDropped: 1,
    });
  });
});

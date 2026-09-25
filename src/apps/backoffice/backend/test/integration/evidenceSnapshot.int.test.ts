import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoEvidenceSnapshotRepository } from "../../../../../Contexts/Monitoring/Forecast/infrastructure/MongoEvidenceSnapshotRepository.js";
import {
  captureEvidenceSnapshot,
  hashSnapshotContent,
  restoreForecastContext,
} from "../../../../../Contexts/Monitoring/Forecast/domain/EvidenceSnapshot.js";
import { ForecastContext } from "../../../../../Contexts/Monitoring/Forecast/domain/ForecastContext.js";
import { sharedMongoClient } from "./support.js";

/**
 * MongoEvidenceSnapshotRepository の実 Mongo 疎通（T0-2）。
 * 「読み戻したバイト列が保存時と同じハッシュになる」「同じ入力は1件に畳まれ最初の capturedAt が残る」は
 * 実際の BSON 往復と _id の一意性に依存するので、fake ではなくここで固定する。
 */
const context: ForecastContext = {
  horizon: "今週末",
  signals: [
    {
      id: "sch-1",
      kind: "SCHEDULE",
      subject: "checkout",
      when: "土 20:00-23:00",
      desc: "週末セール（絵文字や全角も往復させる 🛒）",
      source: "schedule.seed",
    },
  ],
};

describe("MongoEvidenceSnapshotRepository (integration)", () => {
  let mongo: MongoClient;
  let repository: MongoEvidenceSnapshotRepository;

  beforeAll(async () => {
    mongo = await sharedMongoClient();
    repository = new MongoEvidenceSnapshotRepository(mongo);
  });

  beforeEach(async () => {
    await mongo.db().collection("evidence_snapshots").deleteMany({});
  });

  afterAll(async () => {
    await mongo.db().collection("evidence_snapshots").deleteMany({});
  });

  it("同じ snapshot を2回読み、入力バイト列のハッシュが一致し snapshotId とも一致する", async () => {
    const snapshot = captureEvidenceSnapshot(context, new Date("2026-09-26T00:00:00.000Z"));
    await repository.save(snapshot);

    const first = await repository.findById(snapshot.snapshotId);
    const second = await repository.findById(snapshot.snapshotId);

    expect(hashSnapshotContent(first!.content)).toBe(hashSnapshotContent(second!.content));
    expect(hashSnapshotContent(first!.content)).toBe(snapshot.snapshotId);
    expect(first!.capturedAt.toISOString()).toBe("2026-09-26T00:00:00.000Z");
    expect(restoreForecastContext(first!)).toEqual(context);
  });

  it("同じ入力の2回目の保存は何もしない（1件のまま・最初の capturedAt が残る）", async () => {
    const early = captureEvidenceSnapshot(context, new Date("2026-09-26T00:00:00.000Z"));
    const late = captureEvidenceSnapshot(context, new Date("2026-09-27T00:00:00.000Z"));

    await repository.save(early);
    await repository.save(late);

    expect(await mongo.db().collection("evidence_snapshots").countDocuments({})).toBe(1);
    const stored = await repository.findById(early.snapshotId);
    expect(stored!.capturedAt.toISOString()).toBe("2026-09-26T00:00:00.000Z");
  });

  it("無い snapshotId は null", async () => {
    expect(await repository.findById("0".repeat(64))).toBeNull();
  });
});

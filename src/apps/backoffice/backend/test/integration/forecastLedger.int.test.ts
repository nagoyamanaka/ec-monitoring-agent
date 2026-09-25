import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoForecastLedgerRepository } from "../../../../../Contexts/Monitoring/Forecast/infrastructure/MongoForecastLedgerRepository.js";
import { ForecastIssued } from "../../../../../Contexts/Monitoring/Forecast/domain/ForecastLedger.js";
import { sharedMongoClient } from "./support.js";

/**
 * MongoForecastLedgerRepository の実 Mongo 疎通（T0-1）。
 * 「同じ forecastId の issued を二度書けない」は部分一意インデックスに依存する性質で、
 * fake では構造上テストできないのでここで固定する。
 */
const issued = (forecastId: string): ForecastIssued => ({
  eventType: "issued",
  forecastId,
  briefingId: "briefing-1",
  protocolVersion: "unregistered",
  forecasterVersion: "fv",
  subjectKey: "checkout",
  class: "load_risk",
  level: "HIGH",
  issuedAt: new Date("2026-09-24T00:00:00.000Z"),
  windowLengthHours: 24,
  windowEndsAt: new Date("2026-09-25T00:00:00.000Z"),
  windowPolicyVersion: "wp",
  evidenceSnapshotId: "",
  signalFingerprint: "fp",
  assignment: "normal",
  assignmentProb: 1,
});

describe("MongoForecastLedgerRepository (integration)", () => {
  let mongo: MongoClient;
  let ledger: MongoForecastLedgerRepository;

  beforeAll(async () => {
    mongo = await sharedMongoClient();
    ledger = new MongoForecastLedgerRepository(mongo);
  });

  beforeEach(async () => {
    await mongo.db().collection("forecast_ledger").deleteMany({});
  });

  afterAll(async () => {
    await mongo.db().collection("forecast_ledger").deleteMany({});
  });

  it("issued を追記し、Date を往復させて読み戻せる", async () => {
    await ledger.append(issued("11111111-1111-4111-8111-111111111111"));

    const [row] = await ledger.findAll();
    expect(row).toEqual(issued("11111111-1111-4111-8111-111111111111"));
  });

  it("同じ forecastId の issued は二度書けない（行は1行のまま）", async () => {
    await ledger.append(issued("22222222-2222-4222-8222-222222222222"));

    await expect(ledger.append(issued("22222222-2222-4222-8222-222222222222"))).rejects.toThrow(
      /duplicate key/,
    );
    expect(await mongo.db().collection("forecast_ledger").countDocuments({})).toBe(1);
  });
});

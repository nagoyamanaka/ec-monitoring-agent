import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoAppliedInfraChangeStore } from "../../../../../Contexts/Monitoring/AIInvestigation/infrastructure/infrainvestigation/MongoAppliedInfraChangeStore.js";
import { TerraformResourceChange } from "../../../../../Contexts/Monitoring/AIInvestigation/domain/InfraEvidence.js";
import { sharedMongoClient } from "./support.js";

/**
 * MongoAppliedInfraChangeStore の実 Mongo 疎通。
 * appliedAt を ISO 文字列で保存し $gte（辞書順）で時間窓を引く実装のため、
 * 「窓の内外の選別」と「新しい順ソート」を実データベースで検証する
 * （UT の InMemory 版と違い、クエリ意味論が Mongo 側にあるのがこのテストの対象）。
 */
const CHANGE: TerraformResourceChange = {
  address: "google_sql_database_instance.main",
  action: "update",
  attributeDeltas: [
    { key: "settings.database_flags.max_connections", before: "100", after: "20" },
  ],
};

describe("MongoAppliedInfraChangeStore (integration)", () => {
  let mongo: MongoClient;
  let store: MongoAppliedInfraChangeStore;

  beforeAll(async () => {
    mongo = await sharedMongoClient();
    await mongo.db().collection("applied_infra_changes").deleteMany({});
    store = new MongoAppliedInfraChangeStore(mongo);
  });

  afterAll(async () => {
    await mongo?.close();
  });

  it("findAppliedSince は since より前を除外し、新しい順で返す", async () => {
    const base = Date.now();
    await store.record({
      appliedAt: new Date(base - 60 * 60 * 1000),
      resourceChanges: [CHANGE],
      summary: "窓の外（1時間前）",
    });
    await store.record({
      appliedAt: new Date(base - 10 * 60 * 1000),
      resourceChanges: [CHANGE],
      commitSha: "cafebabe12345678",
      url: "https://github.com/example/infra/pull/1",
      summary: "10分前",
    });
    await store.record({
      appliedAt: new Date(base - 3 * 60 * 1000),
      resourceChanges: [CHANGE],
      summary: "3分前",
    });

    const found = await store.findAppliedSince(new Date(base - 30 * 60 * 1000));

    expect(found.map((c) => c.summary)).toEqual(["3分前", "10分前"]);
    expect(found[0].appliedAt).toBeInstanceOf(Date);
    expect(found[0].resourceChanges).toEqual([CHANGE]);
  });

  it("commitSha/url は任意項目としてラウンドトリップする（未指定なら undefined）", async () => {
    const found = await store.findAppliedSince(new Date(Date.now() - 30 * 60 * 1000));

    const withLink = found.find((c) => c.summary === "10分前");
    expect(withLink?.commitSha).toBe("cafebabe12345678");
    expect(withLink?.url).toBe("https://github.com/example/infra/pull/1");

    const withoutLink = found.find((c) => c.summary === "3分前");
    expect(withoutLink?.commitSha).toBeUndefined();
    expect(withoutLink?.url).toBeUndefined();
  });
});

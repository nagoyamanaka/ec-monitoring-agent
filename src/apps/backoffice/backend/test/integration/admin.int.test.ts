import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { MongoAlertRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { RESOLVED_INCIDENT_SEEDS } from "../../../../../Contexts/Monitoring/seeds/ResolvedIncidentSeed.js";
import { INGEST_TOKEN, makeAppAlert, startApp } from "./support.js";

/**
 * routes/adminRoutes.ts に 1:1 対応。
 * POST /admin/similar-incidents/rebuild：x-ingest-token 認証（401）と、Mongo の承認済み Alert を
 * 数えて類似コーパスへ index し直す（rebuilt=承認数・却下は数えない）ことを検証する。
 * SimilarIncident は InMemory（ES 無し）＝ここで見るのは「正本→派生」の配線と件数。
 */
describe("adminRoutes (integration)", () => {
  let app: BackofficeApp;
  let alertRepository: MongoAlertRepository;

  beforeAll(async () => {
    const started = await startApp();
    app = started.app;
    alertRepository = new MongoAlertRepository(started.mongo);
  });

  afterAll(async () => {
    await app?.stop();
  });

  it("token 不一致は 401", async () => {
    const res = await request(app.httpApp)
      .post("/admin/similar-incidents/rebuild")
      .set("x-ingest-token", "wrong")
      .send();
    expect(res.status).toBe(401);
  });

  it("POST /admin/similar-incidents/rebuild は承認済み Alert の件数だけ index し直す（却下は含まない）", async () => {
    await alertRepository.save(makeAppAlert(randomUUID()).submitFeedback({ isCorrect: true }));
    await alertRepository.save(
      makeAppAlert(randomUUID(), "ec.payment.declined").submitFeedback({
        isCorrect: true,
        operatorNote: "フェイルオーバーで解消",
      }),
    );
    await alertRepository.save(makeAppAlert(randomUUID()).submitFeedback({ isCorrect: false }));
    await alertRepository.save(makeAppAlert(randomUUID())); // 未判定

    const res = await request(app.httpApp)
      .post("/admin/similar-incidents/rebuild")
      .set("x-ingest-token", INGEST_TOKEN)
      .send();

    expect(res.status).toBe(200);
    // DEMO_ENABLED=true（vitest.integration.config.ts）なので seed も入れ直す
    expect(res.body).toEqual({ rebuilt: 2, seeded: RESOLVED_INCIDENT_SEEDS.length });
  });
});

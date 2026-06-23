import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { MongoAlertRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { makeAppAlert, startApp } from "./support.js";

/**
 * routes/analyticsRoutes.ts に 1:1 対応。
 * GET /analytics（集計）。外部依存なし＝Mongo の集計を素通しで検証する。
 */
describe("analyticsRoutes (integration)", () => {
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

  it("GET /analytics は seed 件数を反映した totalAlerts を返す", async () => {
    await alertRepository.save(makeAppAlert(randomUUID()));
    await alertRepository.save(makeAppAlert(randomUUID()));

    const res = await request(app.httpApp).get("/analytics");

    expect(res.status).toBe(200);
    expect(typeof res.body.totalAlerts).toBe("number");
    expect(res.body.totalAlerts).toBeGreaterThanOrEqual(2);
  });
});

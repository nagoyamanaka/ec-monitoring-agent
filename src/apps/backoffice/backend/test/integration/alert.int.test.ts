import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { MongoAlertRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { makeAppAlert, startApp } from "./support.js";

/**
 * routes/alertRoutes.ts に 1:1 対応。
 * GET /alerts（一覧）/ GET /alerts/:id（単体）/ PATCH /alerts/:id/feedback（フィードバック）。
 * 外部依存なし＝ルーティング→QueryBus/CommandBus→UseCase→Mongo を素通しで検証する。
 */
describe("alertRoutes (integration)", () => {
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

  it("GET /alerts は seed したアラートを含む一覧を返す", async () => {
    const alertId = randomUUID();
    await alertRepository.save(makeAppAlert(alertId));

    const res = await request(app.httpApp).get("/alerts");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(res.body.alerts.map((a: { id: string }) => a.id)).toContain(alertId);
  });

  it("GET /alerts/:id は単一アラートを返す", async () => {
    const alertId = randomUUID();
    await alertRepository.save(makeAppAlert(alertId));

    const res = await request(app.httpApp).get(`/alerts/${alertId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: alertId });
  });

  it("PATCH /alerts/:id/feedback は 200 を返し、評価が永続化される", async () => {
    const alertId = randomUUID();
    await alertRepository.save(makeAppAlert(alertId));

    const res = await request(app.httpApp)
      .patch(`/alerts/${alertId}/feedback`)
      .send({ isCorrect: true, operatorNote: "原因推定は妥当" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    // コマンドが Mongo まで到達し、フィードバックが永続化されている（再取得で確認）。
    const after = await request(app.httpApp).get(`/alerts/${alertId}`);
    expect(after.status).toBe(200);
    expect(after.body.feedback).toMatchObject({ isCorrect: true, operatorNote: "原因推定は妥当" });
    expect(after.body.correctFeedbackCount).toBe(1);
  });
});

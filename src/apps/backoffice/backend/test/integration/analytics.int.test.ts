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
    // 昇格（結晶化）パターン数はバリューストリップの成果指標として同梱する
    expect(typeof res.body.promotedPatternCount).toBe("number");
  });

  it("却下 → 再調査 → 承認 の判定履歴が Mongo を往復しても母数が 2 増える", async () => {
    // 分母が縮まないことは Mongo の doc に履歴が載って初めて成立する（ADR-29）。
    // 他テストと DB を共有するので、絶対値でなく差分で見る。
    const before = await request(app.httpApp).get("/analytics");

    const reviewed = makeAppAlert(randomUUID())
      .submitFeedback({ isCorrect: false, operatorNote: "原因が違う" })
      .reopenForReinvestigation()
      .submitFeedback({ isCorrect: true });
    await alertRepository.save(reviewed);

    const after = await request(app.httpApp).get("/analytics");

    expect(after.body.withFeedbackCount - before.body.withFeedbackCount).toBe(2);
    expect(after.body.correctCount - before.body.correctCount).toBe(1);
    expect(after.body.incorrectCount - before.body.incorrectCount).toBe(1);
  });
});

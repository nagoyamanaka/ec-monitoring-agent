import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { MongoKnownErrorPatternRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoKnownErrorPatternRepository.js";
import { KnownErrorPattern } from "../../../../../Contexts/Monitoring/AlertAnalysis/domain/KnownErrorPattern.js";
import { AlertSeverity } from "../../../../../Contexts/Monitoring/Shared/domain/AlertSeverity.js";
import { startApp } from "./support.js";

/**
 * routes/patternRoutes.ts に 1:1 対応。
 * GET /patterns（一覧）/ POST /patterns/:id/promote（手動昇格）。
 * 外部依存なし＝CommandBus/QueryBus→Mongo を素通しで検証する。
 */
const seedPattern = (id: string): KnownErrorPattern =>
  KnownErrorPattern.create({
    id,
    name: "DB接続枯渇",
    description: "コネクションプール枯渇による接続失敗",
    eventNamePattern: "ec.payment.timeout",
    payloadConditions: [],
    severity: AlertSeverity.critical(),
    suggestedAction: "プールサイズを見直す",
  });

describe("patternRoutes (integration)", () => {
  let app: BackofficeApp;
  let patternRepository: MongoKnownErrorPatternRepository;

  beforeAll(async () => {
    const started = await startApp();
    app = started.app;
    patternRepository = new MongoKnownErrorPatternRepository(started.mongo);
  });

  afterAll(async () => {
    await app?.stop();
  });

  it("GET /patterns は seed したパターンを返す", async () => {
    const id = randomUUID();
    await patternRepository.save(seedPattern(id));

    const res = await request(app.httpApp).get("/patterns");

    expect(res.status).toBe(200);
    expect(res.body.patterns.map((p: { id: string }) => p.id)).toContain(id);
  });

  it("POST /patterns/:id/promote は 200 を返し isPromoted=true になる", async () => {
    const id = randomUUID();
    await patternRepository.save(seedPattern(id));

    const res = await request(app.httpApp).post(`/patterns/${id}/promote`).send();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const after = await patternRepository.findById(id);
    expect(after?.isPromoted).toBe(true);
  });
});

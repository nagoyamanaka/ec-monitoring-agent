import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { InfraInvestigationPort } from "../../../../../Contexts/Monitoring/AIInvestigation/domain/InfraInvestigationPort.js";
import { InfraEvidence } from "../../../../../Contexts/Monitoring/AIInvestigation/domain/InfraEvidence.js";
import { MongoAlertRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { makeAppAlert, startApp } from "./support.js";

/**
 * routes/evidenceRoutes.ts に 1:1 対応。
 * GET /alerts/:id/evidence（インフラ証拠の再収集）。
 * 調査の進捗（done/analyzing）は SSE で push される alert.status からフロントが導出するため、
 * 専用の investigation/status エンドポイントは持たない。
 * evidence は infraInvestigationPort が Cloud Logging/Terraform/GitHub を読む外部依存のため、
 * その port だけ vi.fn で差し替える（残りは本物の Mongo/QueryBus）。
 */
const EVIDENCE: InfraEvidence = {
  appLogs: [
    { timestamp: new Date("2026-01-01T00:00:00.000Z"), severity: "ERROR", message: "pool exhausted", resource: "ec-backend" },
  ],
  collectedAt: new Date("2026-01-01T00:00:01.000Z"),
};

describe("evidenceRoutes (integration)", () => {
  let app: BackofficeApp;
  let alertRepository: MongoAlertRepository;
  const collect = vi.fn<
    Parameters<InfraInvestigationPort["collect"]>,
    ReturnType<InfraInvestigationPort["collect"]>
  >();

  beforeAll(async () => {
    const started = await startApp({ infraInvestigationPort: { collect } });
    app = started.app;
    alertRepository = new MongoAlertRepository(started.mongo);
  });

  afterAll(async () => {
    await app?.stop();
  });

  it("GET /alerts/:id/evidence は port が集めた証拠を ISO 正規化して返す", async () => {
    const alertId = randomUUID();
    await alertRepository.save(makeAppAlert(alertId));
    collect.mockResolvedValue(EVIDENCE);

    const res = await request(app.httpApp).get(`/alerts/${alertId}/evidence`);

    expect(res.status).toBe(200);
    expect(collect).toHaveBeenCalledTimes(1);
    expect(res.body.appLogs).toHaveLength(1);
    expect(res.body.appLogs[0]).toMatchObject({ severity: "ERROR", message: "pool exhausted" });
    expect(res.body.appLogs[0].timestamp).toBe("2026-01-01T00:00:00.000Z");
  });
});

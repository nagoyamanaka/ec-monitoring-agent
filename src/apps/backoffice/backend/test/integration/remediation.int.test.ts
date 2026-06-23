import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { RemediationPort } from "../../../../../Contexts/Monitoring/AIInvestigation/domain/remediation/RemediationPort.js";
import { MongoAlertRepository } from "../../../../../Contexts/Monitoring/AlertAnalysis/infrastructure/persistence/MongoAlertRepository.js";
import { makeSecurityAlert, startApp } from "./support.js";

/**
 * routes/remediationRoutes.ts に 1:1 対応。
 * POST /alerts/:id/remediation/draft-pr → GET /alerts/:id/remediation。
 * advisory パイプライン（CommandBus→UseCase→planner(Stub)→Mongo永続）は本物、
 * 外部の write 境界（GitHub への PR起票）だけ vi.fn で差し替える。
 */
const VULNS = [
  { cveId: "CVE-2024-AAAA", severity: "HIGH", package: "axios", version: "1.6.0", fixedVersion: "1.7.4" },
  { cveId: "CVE-2024-BBBB", severity: "CRITICAL", package: "ws", version: "8.0.0", fixedVersion: "8.17.1" },
];

describe("remediationRoutes (integration)", () => {
  let app: BackofficeApp;
  let alertRepository: MongoAlertRepository;
  const draftPullRequest = vi.fn<
    Parameters<RemediationPort["draftPullRequest"]>,
    ReturnType<RemediationPort["draftPullRequest"]>
  >();

  beforeAll(async () => {
    const started = await startApp({ remediationPort: { draftPullRequest } });
    app = started.app;
    alertRepository = new MongoAlertRepository(started.mongo);
  });

  afterAll(async () => {
    await app?.stop();
  });

  beforeEach(() => {
    draftPullRequest.mockReset();
  });

  it("脆弱性ありで draft-pr すると 202、PR起票され GET で drafted を読める", async () => {
    const alertId = randomUUID();
    await alertRepository.save(makeSecurityAlert(alertId, { vulnerabilities: VULNS, repo: "owner/repo" }));
    const prUrl = "https://github.com/owner/repo/pull/1";
    draftPullRequest.mockResolvedValue({ created: true, pullRequestUrl: prUrl });

    const post = await request(app.httpApp).post(`/alerts/${alertId}/remediation/draft-pr`).send();
    expect(post.status).toBe(202);
    expect(post.body).toEqual({ accepted: true });

    expect(draftPullRequest).toHaveBeenCalledTimes(1);
    expect(draftPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.any(String), branch: expect.any(String), fileChanges: expect.any(Array) }),
    );

    const get = await request(app.httpApp).get(`/alerts/${alertId}/remediation`);
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({ alertId, status: "drafted", pullRequestUrl: prUrl, vulnerabilityCount: VULNS.length });
  });

  it("脆弱性なしは executor を呼ばず skipped を記録する", async () => {
    const alertId = randomUUID();
    await alertRepository.save(makeSecurityAlert(alertId, { foo: "bar" }));

    const post = await request(app.httpApp).post(`/alerts/${alertId}/remediation/draft-pr`).send();
    expect(post.status).toBe(202);
    expect(draftPullRequest).not.toHaveBeenCalled();

    const get = await request(app.httpApp).get(`/alerts/${alertId}/remediation`);
    expect(get.body).toMatchObject({ status: "skipped", pullRequestUrl: null, vulnerabilityCount: 0 });
  });

  it("未起票アラートの GET は status='none'", async () => {
    const get = await request(app.httpApp).get(`/alerts/${randomUUID()}/remediation`);
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({ status: "none", pullRequestUrl: null, vulnerabilityCount: 0 });
  });
});

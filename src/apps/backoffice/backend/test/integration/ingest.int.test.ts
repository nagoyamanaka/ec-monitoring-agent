import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { InfraInvestigationPort } from "../../../../../Contexts/Monitoring/AIInvestigation/domain/InfraInvestigationPort.js";
import { INGEST_TOKEN, startApp } from "./support.js";

/**
 * routes/ingestRoutes.ts に 1:1 対応。
 * POST /ingest/cloud-monitoring / /ingest/security-scan / /ingest/remediation-result。
 * x-ingest-token 認証（401/202）と、検知ソース境界→観測パイプライン合流を検証する。
 * 未知分類後の非同期調査が infraInvestigationPort（外部）を叩くため、その port を stub で無害化する。
 */
describe("ingestRoutes (integration)", () => {
  let app: BackofficeApp;
  // 非同期調査の外部アクセスを遮断（最小の空証拠を返す）。
  const collect = vi.fn<
    Parameters<InfraInvestigationPort["collect"]>,
    ReturnType<InfraInvestigationPort["collect"]>
  >().mockResolvedValue({ appLogs: [], collectedAt: new Date() });

  beforeAll(async () => {
    const started = await startApp({ infraInvestigationPort: { collect } });
    app = started.app;
  });

  afterAll(async () => {
    await app?.stop();
  });

  it("token 不一致は 401", async () => {
    const res = await request(app.httpApp)
      .post("/ingest/security-scan")
      .set("x-ingest-token", "wrong")
      .send({ severity: "CRITICAL" });
    expect(res.status).toBe(401);
  });

  it("POST /ingest/security-scan（CRITICAL）は 202 でアラート化される", async () => {
    const res = await request(app.httpApp)
      .post("/ingest/security-scan")
      .set("x-ingest-token", INGEST_TOKEN)
      .send({
        cveId: "CVE-2024-BBBB",
        severity: "CRITICAL",
        repo: "owner/repo",
        scanner: "trivy",
        vulnerabilities: [{ cveId: "CVE-2024-BBBB", severity: "CRITICAL", fixedVersion: "8.17.1" }],
      });

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ accepted: true, vulnerabilityCount: 1 });

    const alerts = await request(app.httpApp).get("/alerts");
    expect(
      alerts.body.alerts.some(
        (a: { monitoringEvent: { eventName: string } }) =>
          a.monitoringEvent.eventName === "security.vulnerability_detected",
      ),
    ).toBe(true);
  });

  it("POST /ingest/security-scan（HIGH/CRITICAL 未満）は 204 で無視", async () => {
    const res = await request(app.httpApp)
      .post("/ingest/security-scan")
      .set("x-ingest-token", INGEST_TOKEN)
      .send({ severity: "LOW" });
    expect(res.status).toBe(204);
  });

  it("POST /ingest/cloud-monitoring は 202 で eventName を返す（ヘッダ認証）", async () => {
    const res = await request(app.httpApp)
      .post("/ingest/cloud-monitoring")
      .set("x-ingest-token", INGEST_TOKEN)
      .send({ incident: { incident_id: randomUUID(), condition_name: "High CPU", state: "open", severity: "Critical" } });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(true);
    expect(typeof res.body.eventName).toBe("string");
  });

  it("POST /ingest/cloud-monitoring は 202 で eventName を返す（クエリ ?token= 認証）", async () => {
    const res = await request(app.httpApp)
      .post(`/ingest/cloud-monitoring?token=${INGEST_TOKEN}`)
      .send({ incident: { incident_id: randomUUID(), condition_name: "High Memory", state: "open", severity: "Warning" } });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(true);
    expect(typeof res.body.eventName).toBe("string");
  });

  it("POST /ingest/cloud-monitoring は ?token= 不一致で 401", async () => {
    const res = await request(app.httpApp)
      .post("/ingest/cloud-monitoring?token=wrong-token")
      .send({ incident: { incident_id: randomUUID(), condition_name: "High CPU", state: "open", severity: "Critical" } });

    expect(res.status).toBe(401);
  });

  it("POST /ingest/remediation-result は必須欠落で 400、正常で 202＋GET で読める", async () => {
    const bad = await request(app.httpApp)
      .post("/ingest/remediation-result")
      .set("x-ingest-token", INGEST_TOKEN)
      .send({ status: "drafted" });
    expect(bad.status).toBe(400);

    const alertId = randomUUID();
    const ok = await request(app.httpApp)
      .post("/ingest/remediation-result")
      .set("x-ingest-token", INGEST_TOKEN)
      .send({ alertId, status: "drafted", pullRequestUrl: "https://github.com/owner/repo/pull/9" });
    expect(ok.status).toBe(202);

    const get = await request(app.httpApp).get(`/alerts/${alertId}/remediation`);
    expect(get.body).toMatchObject({ status: "drafted", pullRequestUrl: "https://github.com/owner/repo/pull/9" });
  });
});

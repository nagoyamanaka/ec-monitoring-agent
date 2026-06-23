import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { EcDemoGateway } from "../../src/demo/EcDemoGateway.js";
import { startApp } from "./support.js";

/**
 * routes/demoRoutes.ts に 1:1 対応。
 * POST /demo/payment-mode / /demo/scenario/:id/trigger / /demo/reset / GET /demo/status。
 * payment-mode と scenario は EC backend を叩くため ecDemoGateway を vi.fn に差し替える。
 * （DEMO_ENABLED=true は vitest.integration.config.ts で設定済み＝demoGuard を通す。）
 */
describe("demoRoutes (integration)", () => {
  let app: BackofficeApp;
  const setPaymentMode = vi.fn().mockResolvedValue(undefined);
  const setInventoryMode = vi.fn().mockResolvedValue(undefined);
  const placeOrder = vi.fn().mockImplementation(async (p: { orderId: string }) => ({ orderId: p.orderId }));
  const ecDemoGateway = { setPaymentMode, setInventoryMode, placeOrder } as unknown as EcDemoGateway;

  beforeAll(async () => {
    const started = await startApp({ ecDemoGateway });
    app = started.app;
  });

  afterAll(async () => {
    await app?.stop();
  });

  it("POST /demo/payment-mode は EC へ中継し mode を返す", async () => {
    const res = await request(app.httpApp).post("/demo/payment-mode").send({ mode: "TIMEOUT" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mode: "TIMEOUT" });
    expect(setPaymentMode).toHaveBeenCalledWith("TIMEOUT");
  });

  it("POST /demo/scenario/:id/trigger は既知シナリオで 202、未知で 400", async () => {
    const ok = await request(app.httpApp).post("/demo/scenario/payment-timeout/trigger").send();
    expect(ok.status).toBe(202);
    expect(ok.body).toMatchObject({ scenarioId: "payment-timeout" });
    expect(placeOrder).toHaveBeenCalledTimes(1);

    const bad = await request(app.httpApp).post("/demo/scenario/bogus/trigger").send();
    expect(bad.status).toBe(400);
  });

  it("POST /demo/reset は 200 を返す", async () => {
    const res = await request(app.httpApp).post("/demo/reset").send();
    expect(res.status).toBe(200);
  });

  it("GET /demo/status は demoEnabled=true と集計を返す", async () => {
    const res = await request(app.httpApp).get("/demo/status");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ demoEnabled: true });
    expect(typeof res.body.totalAlerts).toBe("number");
    expect(typeof res.body.patternCount).toBe("number");
  });
});

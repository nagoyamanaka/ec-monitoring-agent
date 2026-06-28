import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { BackofficeApp } from "../../src/BackofficeApp.js";
import { EcDemoGateway } from "../../src/demo/EcDemoGateway.js";
import { startApp } from "./support.js";

/**
 * routes/demoRoutes.ts に 1:1 対応。
 * POST /demo/scenario/:id/trigger / /demo/reset / GET /demo/status。
 * scenario は EC backend を叩くため ecDemoGateway を vi.fn に差し替える
 * （シナリオ内部で setPaymentMode/setInventoryMode/placeOrder/injectInfraFault を呼ぶ）。
 * 決済モードの単独エンドポイントは廃止（シナリオ注入が EC へ内部設定する方針）。
 * （DEMO_ENABLED=true は vitest.integration.config.ts で設定済み＝demoGuard を通す。）
 */
describe("demoRoutes (integration)", () => {
  let app: BackofficeApp;
  const setPaymentMode = vi.fn().mockResolvedValue(undefined);
  const setInventoryMode = vi.fn().mockResolvedValue(undefined);
  const placeOrder = vi.fn().mockImplementation(async (p: { orderId: string }) => ({ orderId: p.orderId }));
  const injectInfraFault = vi.fn().mockResolvedValue(undefined);
  const ecDemoGateway = {
    setPaymentMode,
    setInventoryMode,
    placeOrder,
    injectInfraFault,
  } as unknown as EcDemoGateway;

  beforeAll(async () => {
    const started = await startApp({ ecDemoGateway });
    app = started.app;
  });

  afterAll(async () => {
    await app?.stop();
  });

  it("POST /demo/scenario/:id/trigger は既知シナリオで 202、未知で 400", async () => {
    const ok = await request(app.httpApp).post("/demo/scenario/payment-timeout/trigger").send();
    expect(ok.status).toBe(202);
    expect(ok.body).toMatchObject({ scenarioId: "payment-timeout" });
    expect(setPaymentMode).toHaveBeenCalledWith("TIMEOUT");
    expect(placeOrder).toHaveBeenCalledTimes(1);

    const bad = await request(app.httpApp).post("/demo/scenario/bogus/trigger").send();
    expect(bad.status).toBe(400);
  });

  it("POST /demo/scenario/infra-fault/trigger は注文を伴わず EC へインフラ障害を注入する", async () => {
    const res = await request(app.httpApp).post("/demo/scenario/infra-fault/trigger").send();
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ scenarioId: "infra-fault" });
    expect(injectInfraFault).toHaveBeenCalledTimes(1);
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

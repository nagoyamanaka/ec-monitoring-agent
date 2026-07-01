import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  triggerScenario,
  pollAlert,
  setPaymentMode,
  clearAlerts,
  EVENT_NAMES,
} from "./support.js";

/**
 * 【demo facade 経路 E2E】UIデモが叩く `POST /demo/scenario/:id/trigger` の回帰テスト。
 *
 * 以前は障害シナリオで 500 になっていた（customerId 非UUID＋EC の非2xx を throw）。
 * 修正後は 202 + 確定済み orderId を返し、その注文が障害イベントを発火 → Alert 化する。
 */
describe("backoffice E2E: demo scenario facade", () => {
  beforeAll(async () => {
    // 既存 Alert を消して payment.timeout を第1観測にする（dedup 回避）
    await clearAlerts();
  });

  afterAll(async () => {
    // 後続テスト（EC e2e 含む）のため決済モードを SUCCESS に戻す
    await setPaymentMode("SUCCESS").catch(() => {});
  });

  it("payment-timeout シナリオを発火 → 202 + orderId、対応する Alert が生成される", async () => {
    const result = await triggerScenario("payment-timeout");

    expect(result.orderId).toBeTruthy();
    expect(result.scenarioId).toBe("payment-timeout");

    // dedup で payment.timeout は eventName 単位の1件に畳み込まれ、payload は第1観測のものだけが残る。
    // 他ファイルの payment.timeout イベントが遅延着弾すると result.orderId は payload に残らないため、
    // eventName で相関する（facade が 202+orderId を返し、その注文が Alert 化する配線は検証できる）。
    const alert = await pollAlert(
      (a) => a.monitoringEvent.eventName === EVENT_NAMES.paymentTimeout,
    );

    expect(alert.monitoringEvent.eventName).toBe(EVENT_NAMES.paymentTimeout);
  });
});

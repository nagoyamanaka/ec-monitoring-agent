import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient } from "mongodb";
import {
  connectMonitoringDb,
  setPaymentMode,
  setInventoryMode,
  placeEcOrder,
  pollAlert,
  EVENT_NAMES,
  PRODUCT_OUT_OF_STOCK,
  KNOWN_ERROR_PATTERNS_COLLECTION,
} from "./support.js";

/**
 * 【未知パターン経路 E2E】AI調査の配線を Stub LLM で検証する（Gemini課金なし・決定論的）。
 *
 * 既知パターンが無い MonitoringEvent は AnalyzeAlert が「未知」分類し ANALYZING で保存、
 * InvestigateAlertDomainEvent を publish → InvestigateAlert が StubLLMClient で調査 →
 * InvestigationReport を添付して OPEN に更新する。
 * 検証対象: 内部 EventBus 経由の非同期調査ループ → レポート添付 → /alerts 反映までの縦串。
 * StubLLMClient（AI_INVESTIGATION_STUB=true）が本物の LLMInvestigationAdapter を素通しするので、
 * パース・ドメインマッピングまで実コードで通る。
 */
describe("backoffice E2E: unknown-investigation path (stub AI)", () => {
  let mongo: MongoClient;
  // 在庫0商品で予約失敗 → ec.inventory.reservation_failed。orderId で相関させる。
  const orderId = crypto.randomUUID();

  beforeAll(async () => {
    mongo = connectMonitoringDb();
    await mongo.connect();
    // この eventName を既知化するパターンが残っていないことを保証（未知経路を確実に通す）
    await mongo
      .db()
      .collection(KNOWN_ERROR_PATTERNS_COLLECTION)
      .deleteMany({ eventNamePattern: EVENT_NAMES.inventoryReservationFailed });
  });

  afterAll(async () => {
    await mongo.close();
  });

  it("未知パターン → AI調査ループが回り、Stub の InvestigationReport が添付されて OPEN になる", async () => {
    await setPaymentMode("SUCCESS");
    await setInventoryMode("SUCCESS");
    // 決済成功 → 注文受付(201) → 在庫0で予約失敗 → 補償経由で InventoryReservationFailedDomainEvent
    await placeEcOrder({
      orderId,
      customerId: crypto.randomUUID(),
      productId: PRODUCT_OUT_OF_STOCK,
    });

    // 調査完了（レポート添付）まで待つ
    const alert = await pollAlert(
      (a) =>
        a.monitoringEvent.eventName === EVENT_NAMES.inventoryReservationFailed &&
        a.monitoringEvent.payload.orderId === orderId &&
        a.investigationReport !== null,
    );

    expect(alert.classification.type).toBe("unknown");
    expect(alert.status).toBe("OPEN");
    // Stub は有効な調査結果を返すため fallback ではない
    expect(alert.investigationReport?.isFallback).toBe(false);
    expect(alert.investigationReport?.summary).toContain("[STUB]");
  });
});

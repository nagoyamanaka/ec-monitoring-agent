import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient } from "mongodb";
import {
  connectMonitoringDb,
  clearAlerts,
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

  beforeAll(async () => {
    mongo = connectMonitoringDb();
    await mongo.connect();
    // ① 既知パターンの削除を Alert クリアより先に行う。
    //   ec/orders（直前ファイル）の在庫不足テストも ec.inventory.reservation_failed
    //   (reason=INSUFFICIENT_STOCK) を発火する。これは seed 済みの既知パターンに一致するため、
    //   その遅延イベントがパターン削除より前に着弾すると「既知」Alert が立ち、
    //   dedup で後続（このテストの観測）を畳み込んでしまい investigationReport が付かず未知経路が壊れる。
    //   先にパターンを消しておけば、遅延イベントが来ても必ず「未知」で分類される。
    await mongo
      .db()
      .collection(KNOWN_ERROR_PATTERNS_COLLECTION)
      .deleteMany({ eventNamePattern: EVENT_NAMES.inventoryReservationFailed });
    // ② 既存 Alert を消して reservation_failed を第1観測にする（dedup 回避）
    await clearAlerts();
  });

  afterAll(async () => {
    await mongo.close();
  });

  it("未知パターン → AI調査ループが回り、Stub の InvestigationReport が添付されて OPEN になる", async () => {
    await setPaymentMode("SUCCESS");
    await setInventoryMode("SUCCESS");
    // 決済成功 → 注文受付(201) → 在庫0で予約失敗 → 補償経由で InventoryReservationFailedDomainEvent
    await placeEcOrder({
      orderId: crypto.randomUUID(),
      customerId: crypto.randomUUID(),
      productId: PRODUCT_OUT_OF_STOCK,
    });

    // dedup で reservation_failed は eventName 単位の1件に畳み込まれるため eventName で相関する。
    // clear 直後に現れるのは自分の観測か遅延した先行観測のどちらかだが、既知パターンは削除済みなので
    // いずれも「未知」→ AI調査ループ → InvestigationReport 添付、まで進む（payload.orderId には依存しない）。
    // 調査完了（レポート添付）まで待つ。
    const alert = await pollAlert(
      (a) =>
        a.monitoringEvent.eventName === EVENT_NAMES.inventoryReservationFailed &&
        a.investigationReport !== null,
    );

    expect(alert.classification.type).toBe("unknown");
    expect(alert.status).toBe("OPEN");
    // Stub は有効な調査結果を返すため fallback ではない
    expect(alert.investigationReport?.isFallback).toBe(false);
    expect(alert.investigationReport?.summary).toContain("[STUB]");
  });
});

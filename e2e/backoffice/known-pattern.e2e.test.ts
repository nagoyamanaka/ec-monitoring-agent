import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient, ObjectId } from "mongodb";
import {
  connectMonitoringDb,
  clearAlerts,
  setPaymentMode,
  setInventoryMode,
  placeEcOrder,
  pollAlert,
  EVENT_NAMES,
  PRODUCT_IN_STOCK,
  KNOWN_ERROR_PATTERNS_COLLECTION,
} from "./support.js";
// Note: ec/orders.e2e.test.ts (runs immediately before this file) also fires a
// payment.timeout event. Alert は dedupKey(source::category::eventName) 単位で
// 畳み込まれ、payload は「最初の観測」のものだけが残る（occurrenceCount が増えるだけ）。
// つまり CI のようにバックエンドがコールドスタートで先行イベントの配信が遅れると、
// ec/orders の payment.timeout がこのテストの clearAlerts 後に第1観測として着弾し、
// 自分の customerId は payload に残らない。したがって payload.customerId で相関するのは
// dedup 設計上そもそも不安定なので、この Alert は eventName で相関させる
// （payment.timeout の未解決 Alert は clear 直後には1件しか存在しえない）。
// clearAlerts() を注文投入の直前にもう一度呼ぶのは、先行 Alert を確実に消してから
// 観測を始めるため。

/**
 * 【既知パターン経路 E2E】Gemini を一切呼ばない・決定論的・無料の縦串テスト。
 *
 * KnownErrorPattern を seed しておくと AnalyzeAlert が完全一致で「既知」分類し、
 * Alert を OPEN で保存・SSE 通知して即終了する（InvestigateAlertDomainEvent を出さない＝AI調査なし）。
 * 検証対象: RabbitMQ ルーティング → MonitoringEvent 正規化 → 分類(完全一致) → Mongo 永続 → /alerts シリアライズ。
 */
describe("backoffice E2E: known-pattern path (no AI)", () => {
  let mongo: MongoClient;
  const SEED_PATTERN_ID = "e2e-known-payment-timeout";

  beforeAll(async () => {
    // 既存 Alert を消して payment.timeout を第1観測にする（dedup 回避）
    await clearAlerts();
    mongo = connectMonitoringDb();
    await mongo.connect();
    const patterns = mongo.db().collection(KNOWN_ERROR_PATTERNS_COLLECTION);
    await patterns.deleteMany({ eventNamePattern: EVENT_NAMES.paymentTimeout });
    await patterns.insertOne({
      _id: SEED_PATTERN_ID as unknown as ObjectId,
      name: "Payment Timeout (E2E seed)",
      description: "E2E 用に投入した既知パターン",
      eventNamePattern: EVENT_NAMES.paymentTimeout,
      payloadConditions: [], // eventName 一致のみで既知判定
      severity: "CRITICAL",
      suggestedAction: "決済プロバイダのタイムアウト設定を確認",
      isPromoted: true,
      promotedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // 後続テスト（EC e2e 含む）のためグローバルな決済モードを SUCCESS に戻す
    await setPaymentMode("SUCCESS").catch(() => {});
    await mongo
      .db()
      .collection(KNOWN_ERROR_PATTERNS_COLLECTION)
      .deleteMany({ _id: SEED_PATTERN_ID as unknown as ObjectId });
    await mongo.close();
  });

  it("既知パターン一致 → Alert は known / OPEN で確定し、AI調査は走らない", async () => {
    await setInventoryMode("SUCCESS");
    await setPaymentMode("TIMEOUT");
    // 直前テスト（ec/orders）の payment.timeout イベントが遅れて到達しても
    // dedup で畳み込まれないよう、注文投入の直前に改めて Alert を空にする。
    await clearAlerts();
    // 在庫ありで予約は通り、決済が TIMEOUT → PaymentTimeoutDomainEvent 発火（EC は 400 を返す）
    await placeEcOrder({
      orderId: crypto.randomUUID(),
      customerId: crypto.randomUUID(),
      productId: PRODUCT_IN_STOCK,
    });

    // dedup で payment.timeout は1件に畳み込まれるため eventName で相関する。
    // clear 直後に現れる payment.timeout Alert は自分の観測か、遅延した先行観測の
    // どちらかだが、いずれも seed パターン（eventName 一致のみ）で「既知」に分類される。
    const alert = await pollAlert(
      (a) => a.monitoringEvent.eventName === EVENT_NAMES.paymentTimeout,
    );

    expect(alert.classification.type).toBe("known");
    expect(alert.status).toBe("OPEN");
    // 短絡終了するため調査レポートは付かない（＝Gemini非依存）
    expect(alert.investigationReport).toBeNull();
  });
});

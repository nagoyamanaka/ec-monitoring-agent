import { MongoClient } from "mongodb";

// backoffice backend（別プロセス・別DB monitoring）に対する E2E 用の共通ヘルパ。
// 障害は EC backend に直接注文を投入して発火させ（既存 EC e2e と同じ作法）、
// その結果生まれる Alert を backoffice 側でポーリング検証する。
// ※ backoffice の demo facade（/demo/scenario）は障害シナリオで EC が返す非2xx を
//   そのまま 500 に変換してしまうため、パイプライン検証では EC を直接叩く。

export const EC_BASE_URL = process.env.EC_BASE_URL ?? "http://localhost:3000";
export const BACKOFFICE_BASE_URL =
  process.env.BACKOFFICE_BASE_URL ?? "http://localhost:3001";
const MONITORING_MONGO_URL =
  process.env.MONITORING_MONGO_URL ?? "mongodb://localhost:27017/monitoring";

export const KNOWN_ERROR_PATTERNS_COLLECTION = "known_error_patterns";
export const ALERTS_COLLECTION = "alerts";

// global-setup が EC の inventory に seed する商品（在庫あり / 在庫0）
export const PRODUCT_IN_STOCK = "11111111-1111-4111-8111-111111111111";
export const PRODUCT_OUT_OF_STOCK = "22222222-2222-4222-8222-222222222222";

// CollectMonitoringEventOnECEventPublished が正規化する eventName（EC DomainEvent 由来）
export const EVENT_NAMES = {
  paymentTimeout: "ec.payment.timeout",
  inventoryReservationFailed: "ec.inventory.reservation_failed",
} as const;

export type AlertPrimitives = {
  id: string;
  monitoringEvent: { eventName: string; payload: Record<string, unknown> };
  status: string;
  classification: { type: "known" | "unknown"; source?: string };
  investigationReport: { isFallback: boolean; summary: string } | null;
};

export function connectMonitoringDb(): MongoClient {
  return new MongoClient(MONITORING_MONGO_URL);
}

// monitoring の alerts コレクションを空にする。
// AnalyzeAlert は dedupKey(source::category::eventName) 単位で「未解決 Alert」へ
// 重複観測を畳み込む（recordOccurrence は最初の observation の payload を保持）。
// 各テストは自分の orderId/customerId が Alert の payload に乗ることを期待するため、
// テスト開始前に既存 Alert を消して「自分の event を第1観測にする」必要がある。
// （demo/reset はパターンのみ再投入するが、他テストの残存 Alert は消さないので直接削除する）
export async function clearAlerts(): Promise<void> {
  const client = connectMonitoringDb();
  await client.connect();
  try {
    await client.db().collection(ALERTS_COLLECTION).deleteMany({});
  } finally {
    await client.close();
  }
}

// backoffice の demo データを seed 初期状態へ戻す（make reset と同じ経路）。
// 返り値はリセット結果のサマリ（seed された件数）。
export async function resetDemo(): Promise<{
  alertsSeeded: number;
  patternsSeeded: number;
}> {
  const res = await fetch(`${BACKOFFICE_BASE_URL}/demo/reset`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`demo reset failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as { alertsSeeded: number; patternsSeeded: number };
}

// GET /alerts の現在のスナップショットを取得する（ポーリングなし・即時）。
export async function fetchAlerts(): Promise<AlertPrimitives[]> {
  const res = await fetch(`${BACKOFFICE_BASE_URL}/alerts`);
  if (!res.ok) throw new Error(`get alerts failed: ${res.status}`);
  const body = (await res.json()) as { alerts: AlertPrimitives[] };
  return body.alerts;
}

export async function setPaymentMode(
  mode: "SUCCESS" | "TIMEOUT" | "RANDOM",
): Promise<void> {
  const res = await fetch(`${EC_BASE_URL}/demo/payment-mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`set payment-mode failed: ${res.status}`);
}

export async function setInventoryMode(
  mode: "SUCCESS" | "INSUFFICIENT_STOCK" | "CONCURRENT_CONFLICT",
): Promise<void> {
  const res = await fetch(`${EC_BASE_URL}/demo/inventory-mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`set inventory-mode failed: ${res.status}`);
}

// EC に注文を投入する。障害シナリオでは EC が 4xx を返す（＝障害発火が成功）ことも
// あるため HTTP ステータスは検証しない。障害イベントが流れたかは Alert 出現で確認する。
export async function placeEcOrder(params: {
  orderId: string;
  customerId: string;
  productId: string;
}): Promise<void> {
  await fetch(`${EC_BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: params.orderId,
      customerId: params.customerId,
      items: [{ productId: params.productId, quantity: 1, unitPrice: 1000 }],
    }),
  });
}

// backoffice の demo facade（UIデモが使う経路）でシナリオを発火する。
// 修正後はここが障害シナリオでも 202 を返し、確定済み orderId を返す。
export async function triggerScenario(
  scenarioId: string,
): Promise<{ scenarioId: string; label: string; orderId: string }> {
  const res = await fetch(
    `${BACKOFFICE_BASE_URL}/demo/scenario/${scenarioId}/trigger`,
    { method: "POST" },
  );
  if (res.status !== 202) {
    throw new Error(
      `scenario "${scenarioId}" trigger failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as { scenarioId: string; label: string; orderId: string };
}

// GET /alerts をポーリングし、述語を満たす Alert が現れるまで待つ。
// テスト側は自分が生成した一意 id（orderId / customerId）で相関させること。
export async function pollAlert(
  predicate: (alert: AlertPrimitives) => boolean,
  { maxAttempts = 25, intervalMs = 1_000 } = {},
): Promise<AlertPrimitives> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${BACKOFFICE_BASE_URL}/alerts`);
    if (res.ok) {
      const body = (await res.json()) as { alerts: AlertPrimitives[] };
      const alert = body.alerts.find(predicate);
      if (alert) return alert;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `No alert satisfied predicate within ${maxAttempts * intervalMs}ms`,
  );
}

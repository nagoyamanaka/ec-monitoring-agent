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

// 類似コーパス（Elasticsearch）の URL とインデックス。ES 未設定（InMemory 構成）なら掃除は no-op。
// compose の e2e ランナーからは elasticsearch:9200、ローカル直実行では localhost:9200 が既定。
export const ELASTICSEARCH_URL =
  process.env.ELASTICSEARCH_URL ?? "http://localhost:9200";
const SIMILAR_INCIDENTS_INDEX =
  process.env.ELASTICSEARCH_SIMILAR_INCIDENTS_INDEX ?? "similar-incidents";

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
  classification: {
    type: "known" | "unknown";
    source?: string;
    patternName?: string;
    // 類似一致（SIMILARITY）の根拠になった解決済みインシデントの元 Alert への back-link。
    // 承認で焼いた訂正事例を突合し「訂正が次回の分類根拠になった」ことを検証するのに使う。
    sourceAlertId?: string;
  };
  investigationReport: {
    isFallback: boolean;
    summary: string;
    investigatedAt: string;
  } | null;
  feedback: { isCorrect: boolean; operatorNote?: string } | null;
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

// GET /alerts/:id で単一 Alert を取得する（現役一覧に載っている Alert 用）。
export async function fetchAlertById(id: string): Promise<AlertPrimitives> {
  const res = await fetch(`${BACKOFFICE_BASE_URL}/alerts/${id}`);
  if (!res.ok) throw new Error(`get alert ${id} failed: ${res.status}`);
  return (await res.json()) as AlertPrimitives;
}

// GET /alerts/:id をポーリングし、その Alert が述語を満たす状態になるまで待つ。
// 非同期アクション（POST /report・POST /reinvestigate は 202 即応答→SSE push）の
// 完了をポーリングで観測するために使う。
export async function pollAlertById(
  id: string,
  predicate: (alert: AlertPrimitives) => boolean,
  { maxAttempts = 25, intervalMs = 1_000 } = {},
): Promise<AlertPrimitives> {
  for (let i = 0; i < maxAttempts; i++) {
    const alert = await fetchAlertById(id).catch(() => null);
    if (alert && predicate(alert)) return alert;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Alert ${id} did not satisfy predicate within ${maxAttempts * intervalMs}ms`,
  );
}

// PATCH /alerts/:id/feedback（承認/却下）。承認は dedup 窓から外れる＝再発火は新規 Alert になる。
export async function submitFeedback(
  id: string,
  params: { isCorrect: boolean; operatorNote?: string },
): Promise<void> {
  const res = await fetch(`${BACKOFFICE_BASE_URL}/alerts/${id}/feedback`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`feedback failed: ${res.status} ${await res.text()}`);
}

// POST /alerts/:id/promote（手動即時昇格＝既知パターンへの結晶化）。
export async function promoteAlert(id: string): Promise<void> {
  const res = await fetch(`${BACKOFFICE_BASE_URL}/alerts/${id}/promote`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`promote failed: ${res.status} ${await res.text()}`);
}

// 指定 resolvedNote（テスト固有の署名）に一致する解決済みインシデントを類似コーパスから削除する。
// ES は永続するため、承認で焼いた学習事例が過去実行から蓄積すると類似一致がタイになり
// sourceAlertId 突合が非決定的になる。テスト固有の文言だけを狙って掃除し、reset シード（別文言）は残す。
// ベストエフォート: ES 未起動/InMemory 構成では失敗を握りつぶして継続する（掃除不要のため）。
export async function clearSimilarIncidentsByNote(note: string): Promise<void> {
  try {
    await fetch(
      `${ELASTICSEARCH_URL}/${SIMILAR_INCIDENTS_INDEX}/_delete_by_query?refresh=true`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: { match_phrase: { resolvedNote: note } } }),
      },
    );
  } catch {
    // ES 未設定（InMemory 構成）・未到達時は掃除不要 = 無視して継続。
  }
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

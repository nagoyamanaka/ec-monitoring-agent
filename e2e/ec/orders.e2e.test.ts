import { describe, it, expect } from "vitest";
import { PRODUCT_IN_STOCK, PRODUCT_OUT_OF_STOCK } from "../global-setup.js";

const BASE_URL = process.env.EC_BASE_URL ?? "http://localhost:3000";

type OrderBody = {
  orders: Array<{
    id: string;
    customerId: string;
    status: string;
    totalAmount: number;
  }>;
};

async function pollOrderStatus(
  orderId: string,
  expectedStatus: string,
  maxAttempts = 15,
  intervalMs = 1_000,
): Promise<OrderBody["orders"][number]> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${BASE_URL}/orders/${orderId}`);
    if (res.ok) {
      const body = (await res.json()) as OrderBody;
      const order = body.orders[0];
      if (order?.status === expectedStatus) return order;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Order ${orderId} did not reach status "${expectedStatus}" within ${maxAttempts * intervalMs}ms`,
  );
}

describe("GET /health", () => {
  it("returns 200", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
  });
});

describe("POST /orders", () => {
  it("決済成功 + 在庫あり → 201 / 注文 PENDING で保存", async () => {
    const orderId = crypto.randomUUID();

    const res = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        customerId: crypto.randomUUID(),
        items: [{ productId: PRODUCT_IN_STOCK, quantity: 1, unitPrice: 1_000 }],
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { orderId: string };
    expect(body.orderId).toBe(orderId);

    const orderRes = await fetch(`${BASE_URL}/orders/${orderId}`);
    expect(orderRes.status).toBe(200);
    const orderBody = (await orderRes.json()) as OrderBody;
    expect(orderBody.orders[0].id).toBe(orderId);
    expect(orderBody.orders[0].status).toBe("PENDING");
  });

  it("決済タイムアウト (TIMEOUT モード) → 400", async () => {
    await fetch(`${BASE_URL}/demo/payment-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "TIMEOUT" }),
    });

    const res = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: crypto.randomUUID(),
        items: [{ productId: PRODUCT_IN_STOCK, quantity: 1, unitPrice: 1_000 }],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { type: string };
    expect(body.type).toBe("application");

    // 次のテストのために SUCCESS に戻す
    await fetch(`${BASE_URL}/demo/payment-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "SUCCESS" }),
    });
  });

  it("在庫不足 → 201 後に補償トランザクションで注文 FAILED", async () => {
    const orderId = crypto.randomUUID();

    const res = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        customerId: crypto.randomUUID(),
        items: [{ productId: PRODUCT_OUT_OF_STOCK, quantity: 1, unitPrice: 500 }],
      }),
    });

    // 注文は受付られる（決済は成功）が、RabbitMQ 経由の補償で FAILED に遷移する
    expect(res.status).toBe(201);

    const order = await pollOrderStatus(orderId, "FAILED");
    expect(order.status).toBe("FAILED");
  });

  it("存在しない注文を GET → 404", async () => {
    const res = await fetch(`${BASE_URL}/orders/${crypto.randomUUID()}`);
    expect(res.status).toBe(404);
  });
});

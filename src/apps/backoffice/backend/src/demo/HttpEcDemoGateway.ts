import {
  DemoOrderItem,
  EcDemoGateway,
  InventoryMode,
  PaymentMode,
} from "./EcDemoGateway.js";

// EC backend の demo / orders エンドポイントへ HTTP で中継する Adapter。
// EC への結合点はここ1箇所だけ。接続先は config.demo.ecBackendUrl。
export class HttpEcDemoGateway implements EcDemoGateway {
  constructor(private readonly ecBackendUrl: string) {}

  async setPaymentMode(mode: PaymentMode): Promise<void> {
    await this.post("/demo/payment-mode", { mode });
  }

  async setInventoryMode(mode: InventoryMode): Promise<void> {
    await this.post("/demo/inventory-mode", { mode });
  }

  async placeOrder(params: {
    customerId: string;
    items: DemoOrderItem[];
  }): Promise<{ orderId: string }> {
    const body = await this.post("/orders", params);
    return { orderId: (body as { orderId: string }).orderId };
  }

  private async post(path: string, payload: unknown): Promise<unknown> {
    const res = await fetch(`${this.ecBackendUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`EC backend ${path} responded ${res.status}`);
    }
    // payment-mode / inventory-mode は本文を使わないが、orders は orderId を返す
    return res.status === 204 ? null : await res.json();
  }
}

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
    orderId: string;
    customerId: string;
    items: DemoOrderItem[];
  }): Promise<{ orderId: string }> {
    // 障害シナリオでは EC が業務的失敗で非2xx（例: 決済TIMEOUT→400）を返すが、
    // 「障害を発火させる」のがデモの目的なので失敗扱いにしない。orderId はクライアント側で
    // 確定済みなので、EC のレスポンス本文に依存せずそのまま返す。
    await fetch(`${this.ecBackendUrl}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return { orderId: params.orderId };
  }

  private async post(path: string, payload: unknown): Promise<void> {
    const res = await fetch(`${this.ecBackendUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`EC backend ${path} responded ${res.status}`);
    }
  }
}

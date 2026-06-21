export type PaymentMode = "SUCCESS" | "RANDOM" | "TIMEOUT";
export type InventoryMode = "SUCCESS" | "INSUFFICIENT_STOCK" | "CONCURRENT_CONFLICT";

export type DemoOrderItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

// backoffice の demo パネルから EC backend の demo 操作を呼ぶための driven port。
// EC への HTTP 結合を1枚の Adapter に閉じ込め、Controller/UseCase を EC から疎結合に保つ。
export interface EcDemoGateway {
  setPaymentMode(mode: PaymentMode): Promise<void>;
  setInventoryMode(mode: InventoryMode): Promise<void>;
  placeOrder(params: {
    orderId: string;
    customerId: string;
    items: DemoOrderItem[];
  }): Promise<{ orderId: string }>;
}

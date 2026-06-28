import { EcDemoGateway, InventoryMode, PaymentMode } from "./EcDemoGateway.js";

export class UnsupportedScenarioError extends Error {
  constructor(scenarioId: string) {
    super(`Unsupported demo scenario: ${scenarioId}`);
  }
}

type ScenarioRecipe = {
  readonly label: string;
  readonly paymentMode: PaymentMode;
  readonly inventoryMode: InventoryMode;
};

// 各シナリオが payment/inventory の両モードを明示設定するので、直前の状態に依存せず独立に再現できる。
const RECIPES: Record<string, ScenarioRecipe> = {
  "payment-timeout": { label: "決済タイムアウト", paymentMode: "TIMEOUT", inventoryMode: "SUCCESS" },
  "inventory-insufficient": { label: "在庫不足", paymentMode: "SUCCESS", inventoryMode: "INSUFFICIENT_STOCK" },
  "inventory-conflict": { label: "在庫競合", paymentMode: "SUCCESS", inventoryMode: "CONCURRENT_CONFLICT" },
};

// 数字エイリアス（UIのシナリオ1/2/3/4）も受ける
const ALIASES: Record<string, string> = {
  "1": "payment-timeout",
  "2": "inventory-insufficient",
  "3": "inventory-conflict",
  "4": "infra-fault",
};

// infra-fault は他シナリオと違い「注文の業務失敗」ではなくインフラ級異常の注入なので、
// payment/inventory のモード設定も注文投入も伴わない（EcDemoGateway.injectInfraFault のみ）。
const INFRA_FAULT_SCENARIO_ID = "infra-fault";

// 障害シナリオを EC 操作の合成で再現する facade。
// EC の demo モードを設定 → 注文を投入 → EC が障害イベントを発火 → Monitoring が Alert 化（SSE配信）。
export class TriggerDemoScenarioUseCase {
  constructor(
    private readonly ecDemoGateway: EcDemoGateway,
    private readonly productId: string,
  ) {}

  async run(scenarioId: string): Promise<{ scenarioId: string; label: string; orderId: string }> {
    const resolvedId = ALIASES[scenarioId] ?? scenarioId;

    if (resolvedId === INFRA_FAULT_SCENARIO_ID) {
      await this.ecDemoGateway.injectInfraFault();
      // 注文を伴わないので orderId は空。Cloud Monitoring 経由で Alert 化されるため即時の orderId 相関は無い。
      return { scenarioId: resolvedId, label: "インフラ障害", orderId: "" };
    }

    const recipe = RECIPES[resolvedId];
    if (!recipe) {
      throw new UnsupportedScenarioError(scenarioId);
    }

    await this.ecDemoGateway.setPaymentMode(recipe.paymentMode);
    await this.ecDemoGateway.setInventoryMode(recipe.inventoryMode);

    // EC の CustomerId/OrderId は UUID 必須。orderId はクライアント側で確定し、
    // 障害で EC が非2xx を返しても相関できるようにする。
    const { orderId } = await this.ecDemoGateway.placeOrder({
      orderId: crypto.randomUUID(),
      customerId: crypto.randomUUID(),
      items: [{ productId: this.productId, quantity: 1, unitPrice: 1000 }],
    });

    return { scenarioId: resolvedId, label: recipe.label, orderId };
  }
}

import { PaymentMockGateway } from "../../Payment/infrastructure/PaymentMockGateway.js";
import { PaymentGateway, PaymentResult } from "../domain/PaymentGateway.js";

export class PaymentMockOrderGateway
  extends PaymentMockGateway
  implements PaymentGateway
{
  async run(params: { orderId: string; amount: number }): Promise<PaymentResult> {
    switch (this.mode) {
      case "SUCCESS":
        return { success: true, transactionId: crypto.randomUUID() };
      case "TIMEOUT":
        return { success: false, reason: "TIMEOUT" };
      // プロバイダ側の全体障害で与信が拒否される体（デモシナリオ2の実トリガ）。
      // decline code は実 PSP が返すエラーコードに相当する語彙。
      case "DECLINED":
        return {
          success: false,
          reason: "DECLINED",
          declineCode: "PROVIDER_UNAVAILABLE",
        };
      case "RANDOM":
        return Math.random() > 0.3
          ? { success: true, transactionId: crypto.randomUUID() }
          : { success: false, reason: "DECLINED" };
    }
  }
}

export type PaymentResult =
  | { success: true; transactionId: string }
  | { success: false; reason: "TIMEOUT" | "DECLINED" | "ERROR" };

export interface PaymentGateway {
  run(params: { orderId: string; amount: number }): Promise<PaymentResult>;
}

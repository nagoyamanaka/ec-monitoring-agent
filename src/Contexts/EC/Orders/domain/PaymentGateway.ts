export type PaymentResult =
  | { success: true; transactionId: string }
  | {
      success: false;
      reason: "TIMEOUT" | "DECLINED" | "ERROR";
      // DECLINED のとき PSP が返す decline code（例: PROVIDER_UNAVAILABLE）。
      // 監視イベントに載る失敗の語彙になるため、PSP 境界のここで受け取る。
      declineCode?: string;
    };

export interface PaymentGateway {
  run(params: { orderId: string; amount: number }): Promise<PaymentResult>;
}

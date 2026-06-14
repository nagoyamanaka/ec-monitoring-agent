// TODO(Step3): Define PaymentGateway interface in domain layer
// This mock supports 3 modes: SUCCESS" | "RANDOM" | "TIMEOUT
// Mode is controlled by PAYMENT_MODE env var (overridable via POST /demo/payment-mode)

export type PaymentMode = "SUCCESS" | "RANDOM" | "TIMEOUT";

export type PaymentRequest = {
  orderId: string;
  customerId: string;
  amount: number;
};

export type PaymentResult =
  | { success: true }
  | { success: false; reason: "TIMEOUT" | "DECLINED" };

export class PaymentMockGateway {
  private mode: PaymentMode;

  constructor(mode: PaymentMode = "SUCCESS") {
    this.mode = mode;
  }

  setMode(mode: PaymentMode): void {
    this.mode = mode;
  }

  async process(_request: PaymentRequest): Promise<PaymentResult> {
    switch (this.mode) {
      case "SUCCESS":
        return { success: true };
      case "TIMEOUT":
        return { success: false, reason: "TIMEOUT" };
      case "RANDOM":
        return Math.random() > 0.3
          ? { success: true }
          : { success: false, reason: "TIMEOUT" };
    }
  }
}

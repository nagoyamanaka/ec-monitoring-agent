export type PaymentMode = "SUCCESS" | "RANDOM" | "TIMEOUT" | "DECLINED";

export class PaymentMockGateway {
  protected mode: PaymentMode;

  constructor(mode: PaymentMode = "SUCCESS") {
    this.mode = mode;
  }

  setMode(mode: PaymentMode): void {
    this.mode = mode;
  }
}

export type PaymentMode = "SUCCESS" | "RANDOM" | "TIMEOUT";

export class PaymentMockGateway {
  protected mode: PaymentMode;

  constructor(mode: PaymentMode = "SUCCESS") {
    this.mode = mode;
  }

  setMode(mode: PaymentMode): void {
    this.mode = mode;
  }
}

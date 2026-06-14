import { ApplicationError } from "../../../../Shared/domain/errors/ApplicationError.js";

export class PlaceOrderFailedError extends ApplicationError {
  readonly errorCode = "PLACE_ORDER_FAILED";

  constructor(orderId: string, reason: string) {
    super(`Failed to place order <${orderId}>: ${reason}`);
  }
}

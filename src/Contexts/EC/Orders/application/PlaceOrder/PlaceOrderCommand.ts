import { Command } from "../../../../Shared/domain/Command.js";

export class PlaceOrderCommand extends Command {
  constructor(
    readonly orderId: string,
    readonly customerId: string,
    readonly items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>,
  ) {
    super();
  }
}

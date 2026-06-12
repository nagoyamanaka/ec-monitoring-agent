import { AggregateRoot } from "../../../Shared/domain/AggregateRoot.js";
import { DomainError } from "../../../Shared/domain/errors/DomainError.js";
import { OrderId } from "./OrderId.js";
import { CustomerId } from "./CustomerId.js";
import { OrderItems, } from "./OrderItems.js";
import { OrderItemPrimitive } from "./OrderItem.js";
import { OrderStatus } from "./OrderStatus.js";
import { TotalAmount } from "./TotalAmount.js";
import { OrderPlacedDomainEvent } from "./events/OrderPlacedDomainEvent.js";
import { InventoryReservationRequestedDomainEvent } from "./events/InventoryReservationRequestedDomainEvent.js";

export class InvalidOrderStatusTransitionError extends DomainError {
  readonly errorCode = "INVALID_ORDER_STATUS_TRANSITION";

  constructor(from: string, to: string) {
    super(`Cannot transition Order status from ${from} to ${to}`);
  }
}

interface OrderPrimitives {
  id: string;
  customerId: string;
  items: OrderItemPrimitive[];
  totalAmount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Order extends AggregateRoot {
  private constructor(
    readonly id: OrderId,
    readonly customerId: CustomerId,
    readonly items: OrderItems,
    readonly totalAmount: TotalAmount,
    private _status: OrderStatus,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  get status(): OrderStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static place(params: {
    id: OrderId;
    customerId: CustomerId;
    items: OrderItems;
  }): Order {
    const now = new Date();
    const totalAmount = params.items.totalAmount();

    const order = new Order(
      params.id,
      params.customerId,
      params.items,
      totalAmount,
      OrderStatus.pending(),
      now,
      now,
    );

    order.record(
      new OrderPlacedDomainEvent({
        orderId: params.id.value,
        customerId: params.customerId.value,
        items: params.items.toPrimitives(),
        totalAmount: totalAmount.value,
      }),
    );

    order.record(
      new InventoryReservationRequestedDomainEvent({
        orderId: params.id.value,
        items: params.items.toPrimitives(),
      }),
    );

    return order;
  }

  confirmInventory(): void {
    if (!this._status.isPending()) {
      throw new InvalidOrderStatusTransitionError(
        this._status.value,
        "CONFIRMED",
      );
    }
    this._status = OrderStatus.confirmed();
    this._updatedAt = new Date();
  }

  failInventory(): void {
    if (!this._status.isPending()) {
      throw new InvalidOrderStatusTransitionError(
        this._status.value,
        "FAILED",
      );
    }
    this._status = OrderStatus.failed();
    this._updatedAt = new Date();
  }

  static fromPrimitives(params: OrderPrimitives): Order {
    return new Order(
      new OrderId(params.id),
      new CustomerId(params.customerId),
      OrderItems.fromPrimitives(params.items),
      new TotalAmount(params.totalAmount),
      OrderStatus.fromString(params.status),
      params.createdAt,
      params.updatedAt,
    );
  }

  toPrimitives(): OrderPrimitives {
    return {
      id: this.id.value,
      customerId: this.customerId.value,
      items: this.items.toPrimitives(),
      totalAmount: this.totalAmount.value,
      status: this._status.value,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

export const OrderTypeValues = {
  ASC: "asc",
  DESC: "desc",
  NONE: "none",
} as const;

export type OrderTypeValue =
  (typeof OrderTypeValues)[keyof typeof OrderTypeValues];

export class CriteriaOrder {
  readonly orderBy: string;
  readonly orderType: OrderTypeValue;

  constructor(orderBy: string, orderType: OrderTypeValue) {
    this.orderBy = orderBy;
    this.orderType = orderType;
  }

  static none(): CriteriaOrder {
    return new CriteriaOrder("", OrderTypeValues.NONE);
  }

  hasOrder(): boolean {
    return this.orderType !== OrderTypeValues.NONE;
  }
}

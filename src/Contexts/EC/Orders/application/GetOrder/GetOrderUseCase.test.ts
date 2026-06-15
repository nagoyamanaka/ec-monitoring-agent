import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetOrderUseCase } from "./GetOrderUseCase.js";
import { InMemoryOrderRepository } from "../../infrastructure/persistence/InMemoryOrderRepository.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { OrderId } from "../../domain/OrderId.js";
import { CustomerId } from "../../domain/CustomerId.js";
import { OrderItems } from "../../domain/OrderItems.js";
import { OrderItem } from "../../domain/OrderItem.js";
import { Order } from "../../domain/Order.js";
import { OrderResponse } from "../OrderResponse.js";
import { OrderResourceNotFoundError } from "../errors/OrderResourceNotFoundError.js";
import { OrderStatusValues } from "../../domain/OrderStatus.js";

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440001";

const makeOrder = () =>
  Order.place({
    id: new OrderId(ORDER_ID),
    customerId: new CustomerId(CUSTOMER_ID),
    items: new OrderItems([new OrderItem("prod-1", 2, 500)]),
  });

describe("GetOrderUseCase", () => {
  let orderRepo: InMemoryOrderRepository;
  let logger: ConsoleLogger;
  let useCase: GetOrderUseCase;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new GetOrderUseCase(orderRepo, logger);
  });

  describe("Order が存在する場合", () => {
    it("OrderResponse を返す", async () => {
      await orderRepo.save(makeOrder());

      const result = await useCase.run(new OrderId(ORDER_ID));

      expect(result).toBeInstanceOf(OrderResponse);
      expect(result.orders).toHaveLength(1);
    });

    it("OrderResponse に正しい id と customerId が含まれる", async () => {
      await orderRepo.save(makeOrder());

      const result = await useCase.run(new OrderId(ORDER_ID));

      const order = result.orders[0];
      expect(order.id).toBe(ORDER_ID);
      expect(order.customerId).toBe(CUSTOMER_ID);
    });

    it("OrderResponse に totalAmount と status が含まれる", async () => {
      await orderRepo.save(makeOrder());

      const result = await useCase.run(new OrderId(ORDER_ID));

      const order = result.orders[0];
      expect(order.totalAmount).toBe(1000); // 2 * 500
      expect(order.status).toBe(OrderStatusValues.PENDING);
    });
  });

  describe("Order が存在しない場合", () => {
    it("OrderResourceNotFoundError を throw する", async () => {
      await expect(useCase.run(new OrderId(ORDER_ID))).rejects.toThrow(
        OrderResourceNotFoundError,
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CompensateOrderUseCase } from "./CompensateOrderUseCase.js";
import { InMemoryOrderRepository } from "../../infrastructure/persistence/InMemoryOrderRepository.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { OrderId } from "../../domain/OrderId.js";
import { CustomerId } from "../../domain/CustomerId.js";
import { OrderItems } from "../../domain/OrderItems.js";
import { OrderItem } from "../../domain/OrderItem.js";
import { Order } from "../../domain/Order.js";
import { OrderStatusValues } from "../../domain/OrderStatus.js";

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440001";

const makePendingOrder = () =>
  Order.place({
    id: new OrderId(ORDER_ID),
    customerId: new CustomerId(CUSTOMER_ID),
    items: new OrderItems([new OrderItem("prod-1", 2, 500)]),
  });

describe("CompensateOrderUseCase", () => {
  let orderRepo: InMemoryOrderRepository;
  let logger: ConsoleLogger;
  let useCase: CompensateOrderUseCase;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new CompensateOrderUseCase(orderRepo, logger);
  });

  describe("Order が存在しない場合", () => {
    it("エラーなく処理を終了する（冪等性）", async () => {
      await expect(useCase.run(ORDER_ID)).resolves.toBeUndefined();
    });

    it("Order は Repository に保存されない", async () => {
      await useCase.run(ORDER_ID);

      const saved = await orderRepo.findById(new OrderId(ORDER_ID));
      expect(saved).toBeNull();
    });
  });

  describe("Order が PENDING の場合", () => {
    it("Order のステータスが FAILED に遷移して保存される", async () => {
      await orderRepo.save(makePendingOrder());

      await useCase.run(ORDER_ID);

      const saved = await orderRepo.findById(new OrderId(ORDER_ID));
      expect(saved!.status.value).toBe(OrderStatusValues.FAILED);
    });
  });

  describe("Order が PENDING 以外の場合", () => {
    it("CONFIRMED の Order はスキップされる（ステータス変化なし）", async () => {
      const order = makePendingOrder();
      order.confirmInventory();
      await orderRepo.save(order);

      await useCase.run(ORDER_ID);

      const saved = await orderRepo.findById(new OrderId(ORDER_ID));
      expect(saved!.status.value).toBe(OrderStatusValues.CONFIRMED);
    });

    it("FAILED の Order はスキップされる（ステータス変化なし）", async () => {
      const order = makePendingOrder();
      order.failInventory();
      await orderRepo.save(order);

      await useCase.run(ORDER_ID);

      const saved = await orderRepo.findById(new OrderId(ORDER_ID));
      expect(saved!.status.value).toBe(OrderStatusValues.FAILED);
    });
  });
});

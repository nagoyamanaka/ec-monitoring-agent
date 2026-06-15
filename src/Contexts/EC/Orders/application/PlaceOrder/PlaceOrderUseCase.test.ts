import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlaceOrderUseCase } from "./PlaceOrderUseCase.js";
import { InMemoryOrderRepository } from "../../infrastructure/persistence/InMemoryOrderRepository.js";
import { InMemoryAsyncEventBus } from "../../../../Shared/infrastructure/EventBus/InMemory/InMemoryAsyncEventBus.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { PaymentMockOrderGateway } from "../../infrastructure/PaymentMockOrderGateway.js";
import { OrderId } from "../../domain/OrderId.js";
import { CustomerId } from "../../domain/CustomerId.js";
import { OrderItems } from "../../domain/OrderItems.js";
import { OrderItem } from "../../domain/OrderItem.js";
import { PlaceOrderFailedError } from "./PlaceOrderFailedError.js";
import { OrderPlacedDomainEvent } from "../../domain/OrderPlacedDomainEvent.js";
import { PaymentTimeoutDomainEvent } from "../../../Payment/domain/PaymentTimeoutDomainEvent.js";

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440001";

const makeParams = () => ({
  id: new OrderId(ORDER_ID),
  customerId: new CustomerId(CUSTOMER_ID),
  items: new OrderItems([new OrderItem("prod-1", 2, 500)]),
});

describe("PlaceOrderUseCase", () => {
  let orderRepo: InMemoryOrderRepository;
  let bus: InMemoryAsyncEventBus;
  let gateway: PaymentMockOrderGateway;
  let logger: ConsoleLogger;
  let useCase: PlaceOrderUseCase;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    bus = new InMemoryAsyncEventBus();
    gateway = new PaymentMockOrderGateway("SUCCESS");
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new PlaceOrderUseCase(orderRepo, bus, gateway, logger);
  });

  describe("Payment 成功", () => {
    it("Order が Repository に保存される", async () => {
      await useCase.run(makeParams());

      const saved = await orderRepo.findById(new OrderId(ORDER_ID));
      expect(saved).not.toBeNull();
      expect(saved!.id.value).toBe(ORDER_ID);
    });

    it("OrderPlacedDomainEvent が1件 publish される", async () => {
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run(makeParams());

      const events = publishSpy.mock.calls.flat(2);
      const event = events.find((e) => e instanceof OrderPlacedDomainEvent);
      expect(event).toBeDefined();
      expect((event as OrderPlacedDomainEvent).aggregateId).toBe(ORDER_ID);
      expect((event as OrderPlacedDomainEvent).customerId).toBe(CUSTOMER_ID);
    });

    it("OrderPlacedDomainEvent に subtotalAmount が含まれる", async () => {
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run(makeParams());

      const events = publishSpy.mock.calls.flat(2);
      const event = events.find(
        (e) => e instanceof OrderPlacedDomainEvent,
      ) as OrderPlacedDomainEvent;
      expect(event.subtotalAmount).toBe(1000); // 2 * 500
    });
  });

  describe("Payment 失敗（TIMEOUT）", () => {
    beforeEach(() => {
      gateway.setMode("TIMEOUT");
    });

    it("PlaceOrderFailedError を throw する", async () => {
      await expect(useCase.run(makeParams())).rejects.toThrow(
        PlaceOrderFailedError,
      );
    });

    it("Order は Repository に保存されない", async () => {
      await expect(useCase.run(makeParams())).rejects.toThrow();

      const saved = await orderRepo.findById(new OrderId(ORDER_ID));
      expect(saved).toBeNull();
    });

    it("PaymentTimeoutDomainEvent が publish され orderId が含まれる", async () => {
      const publishSpy = vi.spyOn(bus, "publish");

      await expect(useCase.run(makeParams())).rejects.toThrow();

      const events = publishSpy.mock.calls.flat(2);
      const event = events.find(
        (e) => e instanceof PaymentTimeoutDomainEvent,
      ) as PaymentTimeoutDomainEvent;
      expect(event).toBeDefined();
      expect(event.orderId).toBe(ORDER_ID);
    });
  });
});

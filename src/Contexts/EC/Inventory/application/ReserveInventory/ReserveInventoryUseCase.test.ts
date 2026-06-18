import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReserveInventoryUseCase } from "./ReserveInventoryUseCase.js";
import { InMemoryInventoryRepository } from "../../infrastructure/persistence/InMemoryInventoryRepository.js";
import { InMemoryAsyncEventBus } from "../../../../Shared/infrastructure/EventBus/InMemory/InMemoryAsyncEventBus.js";
import { ConsoleLogger } from "../../../../Shared/infrastructure/logging/ConsoleLogger.js";
import { Inventory } from "../../domain/Inventory.js";
import { ProductId } from "../../domain/ProductId.js";
import { StockQuantity } from "../../domain/StockQuantity.js";
import { InventoryReservedDomainEvent } from "../../domain/InventoryReservedDomainEvent.js";
import { InventoryReservationFailedDomainEvent } from "../../domain/InventoryReservationFailedDomainEvent.js";
import { InventoryFailureReasons } from "../../domain/InventoryFailureReason.js";

const ORDER_ID = "550e8400-e29b-41d4-a716-446655440000";
const PRODUCT_ID_1 = "550e8400-e29b-41d4-a716-446655440002";
const PRODUCT_ID_2 = "550e8400-e29b-41d4-a716-446655440003";

const makeInventory = (productId: string, stock: number) =>
  Inventory.initialize({
    productId: new ProductId(productId),
    initialStock: new StockQuantity(stock),
  });

describe("ReserveInventoryUseCase", () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let bus: InMemoryAsyncEventBus;
  let logger: ConsoleLogger;
  let useCase: ReserveInventoryUseCase;

  beforeEach(() => {
    inventoryRepo = new InMemoryInventoryRepository();
    bus = new InMemoryAsyncEventBus();
    logger = new ConsoleLogger();
    vi.spyOn(logger, "write").mockResolvedValue(undefined);
    useCase = new ReserveInventoryUseCase(inventoryRepo, bus, logger);
  });

  describe("Phase1: 在庫確認", () => {
    it("在庫が存在しない場合 InventoryReservationFailedDomainEvent(INSUFFICIENT_STOCK) を publish して処理を終了する", async () => {
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run(ORDER_ID, [
        { productId: PRODUCT_ID_1, quantity: 3, unitPrice: 500 },
      ]);

      const events = publishSpy.mock.calls.flat(2);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(InventoryReservationFailedDomainEvent);
      expect(
        (events[0] as InventoryReservationFailedDomainEvent).reason.isInsufficientStock(),
      ).toBe(true);
    });

    it("在庫が不足している場合 InventoryReservationFailedDomainEvent(INSUFFICIENT_STOCK) を publish して処理を終了する", async () => {
      await inventoryRepo.save(makeInventory(PRODUCT_ID_1, 2));
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run(ORDER_ID, [
        { productId: PRODUCT_ID_1, quantity: 5, unitPrice: 500 },
      ]);

      const events = publishSpy.mock.calls.flat(2);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(InventoryReservationFailedDomainEvent);
      expect(
        (events[0] as InventoryReservationFailedDomainEvent).reason.isInsufficientStock(),
      ).toBe(true);
    });

    it("複数商品のうち1品でも在庫不足なら全体を失敗にして処理を終了する", async () => {
      await inventoryRepo.save(makeInventory(PRODUCT_ID_1, 10));
      // PRODUCT_ID_2 は未登録（在庫なし）
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run(ORDER_ID, [
        { productId: PRODUCT_ID_1, quantity: 3, unitPrice: 500 },
        { productId: PRODUCT_ID_2, quantity: 1, unitPrice: 300 },
      ]);

      const events = publishSpy.mock.calls.flat(2);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(InventoryReservationFailedDomainEvent);
      expect(
        (events[0] as InventoryReservationFailedDomainEvent).reason.isInsufficientStock(),
      ).toBe(true);
    });
  });

  describe("Phase2: 在庫引き当て（全成功）", () => {
    it("単一商品の引き当てが成功し InventoryReservedDomainEvent が publish される", async () => {
      await inventoryRepo.save(makeInventory(PRODUCT_ID_1, 10));
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run(ORDER_ID, [
        { productId: PRODUCT_ID_1, quantity: 3, unitPrice: 500 },
      ]);

      const events = publishSpy.mock.calls.flat(2);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(InventoryReservedDomainEvent);
      const e = events[0] as InventoryReservedDomainEvent;
      expect(e.orderId).toBe(ORDER_ID);
      expect(e.reservedQuantity).toBe(3);
      expect(e.remainingStock).toBe(7);
    });

    it("複数商品が全て成功した場合、商品数分の InventoryReservedDomainEvent が一括 publish される", async () => {
      await inventoryRepo.save(makeInventory(PRODUCT_ID_1, 10));
      await inventoryRepo.save(makeInventory(PRODUCT_ID_2, 5));
      const publishSpy = vi.spyOn(bus, "publish");

      await useCase.run(ORDER_ID, [
        { productId: PRODUCT_ID_1, quantity: 3, unitPrice: 500 },
        { productId: PRODUCT_ID_2, quantity: 2, unitPrice: 300 },
      ]);

      const events = publishSpy.mock.calls.flat(2);
      expect(events).toHaveLength(2);
      events.forEach((e) => expect(e).toBeInstanceOf(InventoryReservedDomainEvent));
      // 全商品まとめて1回の publish 呼び出し
      expect(publishSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Phase2: 楽観ロック競合（MAX_RETRIES回失敗）", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it("InventoryReservationFailedDomainEvent(CONCURRENT_CONFLICT) を publish して処理を終了する", async () => {
      await inventoryRepo.save(makeInventory(PRODUCT_ID_1, 10));
      vi.spyOn(inventoryRepo, "reserveStock").mockResolvedValue({
        success: false,
        reason: InventoryFailureReasons.CONCURRENT_CONFLICT,
      });
      const publishSpy = vi.spyOn(bus, "publish");

      const runPromise = useCase.run(ORDER_ID, [
        { productId: PRODUCT_ID_1, quantity: 3, unitPrice: 500 },
      ]);
      await vi.runAllTimersAsync();
      await runPromise;

      const events = publishSpy.mock.calls.flat(2);
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(InventoryReservationFailedDomainEvent);
      expect(
        (events[0] as InventoryReservationFailedDomainEvent).reason.isConcurrentConflict(),
      ).toBe(true);
    });

    it("2品目で競合が発生した場合 reservedProductIds に1品目の ID が含まれる", async () => {
      await inventoryRepo.save(makeInventory(PRODUCT_ID_1, 10));
      await inventoryRepo.save(makeInventory(PRODUCT_ID_2, 10));

      // PRODUCT_ID_1 は成功、PRODUCT_ID_2 で競合
      const original = inventoryRepo.reserveStock.bind(inventoryRepo);
      vi.spyOn(inventoryRepo, "reserveStock").mockImplementation((params) => {
        if (params.productId.value === PRODUCT_ID_2) {
          return Promise.resolve({ success: false, reason: InventoryFailureReasons.CONCURRENT_CONFLICT });
        }
        return original(params);
      });
      const publishSpy = vi.spyOn(bus, "publish");

      const runPromise = useCase.run(ORDER_ID, [
        { productId: PRODUCT_ID_1, quantity: 3, unitPrice: 500 },
        { productId: PRODUCT_ID_2, quantity: 2, unitPrice: 300 },
      ]);
      await vi.runAllTimersAsync();
      await runPromise;

      const events = publishSpy.mock.calls.flat(2);
      const failedEvent = events.find(
        (e) => e instanceof InventoryReservationFailedDomainEvent,
      ) as InventoryReservationFailedDomainEvent;
      expect(failedEvent).toBeDefined();
      expect(failedEvent.reason.isConcurrentConflict()).toBe(true);
      expect(failedEvent.reservedProductIds).toContain(PRODUCT_ID_1);
    });
  });
});

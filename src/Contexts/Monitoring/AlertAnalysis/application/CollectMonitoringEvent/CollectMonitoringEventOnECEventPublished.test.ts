import { describe, it, expect, vi, beforeEach } from "vitest";
import { CollectMonitoringEventOnECEventPublished } from "./CollectMonitoringEventOnECEventPublished.js";
import { CollectMonitoringEventUseCase } from "./CollectMonitoringEventUseCase.js";
import { OrderPlacedDomainEvent } from "../../../../EC/Orders/domain/OrderPlacedDomainEvent.js";
import { InventoryReservationFailedDomainEvent } from "../../../../EC/Inventory/domain/InventoryReservationFailedDomainEvent.js";
import { InventoryFailureReason } from "../../../../EC/Inventory/domain/InventoryFailureReason.js";
import { PaymentTimeoutDomainEvent } from "../../../../EC/Payment/domain/PaymentTimeoutDomainEvent.js";
import { PaymentDeclinedDomainEvent } from "../../../../EC/Payment/domain/PaymentDeclinedDomainEvent.js";
import { MonitoringEvent } from "../../../Shared/domain/MonitoringEvent.js";
import { MonitoringEventCategories } from "../../../Shared/domain/MonitoringEventCategory.js";

const EVENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const ORDER_ID = "550e8400-e29b-41d4-a716-446655440001";
const CUSTOMER_ID = "550e8400-e29b-41d4-a716-446655440002";
const PRODUCT_ID = "550e8400-e29b-41d4-a716-446655440003";
const PAYMENT_ATTEMPT_ID = "550e8400-e29b-41d4-a716-446655440004";
const OCCURRED_ON = new Date("2026-01-01T00:00:00.000Z");

const makeOrderPlacedEvent = () =>
  new OrderPlacedDomainEvent({
    orderId: ORDER_ID,
    customerId: CUSTOMER_ID,
    items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 500 }],
    subtotalAmount: 1000,
    eventId: EVENT_ID,
    occurredOn: OCCURRED_ON,
  });

const makeInventoryReservationFailedEvent = () =>
  new InventoryReservationFailedDomainEvent({
    productId: PRODUCT_ID,
    orderId: ORDER_ID,
    requestedQuantity: 5,
    currentStock: 2,
    reason: InventoryFailureReason.insufficientStock(),
    reservedProductIds: ["prod-a", "prod-b"],
    eventId: EVENT_ID,
    occurredOn: OCCURRED_ON,
  });

const makePaymentTimeoutEvent = () =>
  new PaymentTimeoutDomainEvent({
    paymentAttemptId: PAYMENT_ATTEMPT_ID,
    orderId: ORDER_ID,
    customerId: CUSTOMER_ID,
    amount: 5000,
    eventId: EVENT_ID,
    occurredOn: OCCURRED_ON,
  });

const makePaymentDeclinedEvent = () =>
  new PaymentDeclinedDomainEvent({
    paymentAttemptId: PAYMENT_ATTEMPT_ID,
    orderId: ORDER_ID,
    customerId: CUSTOMER_ID,
    amount: 5000,
    reason: "PROVIDER_UNAVAILABLE",
    eventId: EVENT_ID,
    occurredOn: OCCURRED_ON,
  });

describe("CollectMonitoringEventOnECEventPublished", () => {
  let useCase: { run: ReturnType<typeof vi.fn> };
  let subscriber: CollectMonitoringEventOnECEventPublished;

  beforeEach(() => {
    useCase = { run: vi.fn().mockResolvedValue(undefined) };
    subscriber = new CollectMonitoringEventOnECEventPublished(
      useCase as unknown as CollectMonitoringEventUseCase,
    );
  });

  describe("subscribedTo", () => {
    it("OrderPlaced / InventoryReservationFailed / PaymentTimeout / PaymentDeclined の4イベントを購読する", () => {
      const subscribed = subscriber.subscribedTo();

      expect(subscribed).toContain(OrderPlacedDomainEvent);
      expect(subscribed).toContain(InventoryReservationFailedDomainEvent);
      expect(subscribed).toContain(PaymentTimeoutDomainEvent);
      expect(subscribed).toContain(PaymentDeclinedDomainEvent);
      expect(subscribed).toHaveLength(4);
    });
  });

  describe("OrderPlacedDomainEvent 受信時", () => {
    it("source=order, aggregateId=orderId で MonitoringEvent が構築される", async () => {
      await subscriber.on(makeOrderPlacedEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.source).toBe("order");
      expect(event.aggregateId).toBe(ORDER_ID);
    });

    it("payload に customerId / items / subtotalAmount が含まれる", async () => {
      await subscriber.on(makeOrderPlacedEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.payload).toEqual({
        customerId: CUSTOMER_ID,
        items: [{ productId: PRODUCT_ID, quantity: 2, unitPrice: 500 }],
        subtotalAmount: 1000,
      });
    });

    it("category が APPLICATION である", async () => {
      await subscriber.on(makeOrderPlacedEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.category.value).toBe(MonitoringEventCategories.APPLICATION);
    });
  });

  describe("InventoryReservationFailedDomainEvent 受信時", () => {
    it("source=inventory, aggregateId=productId で MonitoringEvent が構築される", async () => {
      await subscriber.on(makeInventoryReservationFailedEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.source).toBe("inventory");
      expect(event.aggregateId).toBe(PRODUCT_ID);
    });

    it("payload の reason は VO ではなく文字列値である", async () => {
      await subscriber.on(makeInventoryReservationFailedEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.payload.reason).toBe("INSUFFICIENT_STOCK");
    });

    it("payload に reservedProductIds が含まれる", async () => {
      await subscriber.on(makeInventoryReservationFailedEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.payload.reservedProductIds).toEqual(["prod-a", "prod-b"]);
    });
  });

  describe("PaymentTimeoutDomainEvent 受信時", () => {
    it("aggregateId は orderId でなく paymentAttemptId である", async () => {
      await subscriber.on(makePaymentTimeoutEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.aggregateId).toBe(PAYMENT_ATTEMPT_ID);
      expect(event.aggregateId).not.toBe(ORDER_ID);
    });

    it("source=payment で、orderId は payload 側に含まれる", async () => {
      await subscriber.on(makePaymentTimeoutEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.source).toBe("payment");
      expect(event.payload).toEqual({
        orderId: ORDER_ID,
        customerId: CUSTOMER_ID,
        amount: 5000,
      });
    });
  });

  describe("PaymentDeclinedDomainEvent 受信時", () => {
    it("severity=WARNING・source=payment で、payload に decline reason が含まれる", async () => {
      await subscriber.on(makePaymentDeclinedEvent());

      const [event] = useCase.run.mock.calls[0] as [MonitoringEvent];
      expect(event.eventName).toBe("ec.payment.declined");
      expect(event.severity.value).toBe("WARNING");
      expect(event.isAlertable()).toBe(true);
      expect(event.source).toBe("payment");
      expect(event.aggregateId).toBe(PAYMENT_ATTEMPT_ID);
      expect(event.payload).toEqual({
        orderId: ORDER_ID,
        customerId: CUSTOMER_ID,
        amount: 5000,
        reason: "PROVIDER_UNAVAILABLE",
      });
    });
  });
});

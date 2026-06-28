import { describe, it, expect } from "vitest";
import { AlertSeverity } from "./AlertSeverity.js";
import { MonitoringEvent } from "./MonitoringEvent.js";
import { MonitoringEventCategory } from "./MonitoringEventCategory.js";
import { Uuid } from "../../../Shared/domain/value-object/Uuid.js";

describe("MonitoringEvent toPrimitives / fromPrimitives", () => {
  const original = new MonitoringEvent({
    eventId: Uuid.random().value,
    eventName: "ec.payment.timeout",
    aggregateId: "payment-001",
    occurredOn: new Date("2026-01-01T00:00:00Z"),
    payload: { orderId: "order-001", amount: 5000 },
    category: MonitoringEventCategory.application(),
    severity: AlertSeverity.critical(),
    source: "payment",
  });

  it("ラウンドトリップで同じ値が復元される", () => {
    const restored = MonitoringEvent.fromPrimitives(original.toPrimitives());

    expect(restored.eventId).toBe(original.eventId);
    expect(restored.eventName).toBe(original.eventName);
    expect(restored.aggregateId).toBe(original.aggregateId);
    expect(restored.occurredOn.toISOString()).toBe(original.occurredOn.toISOString());
    expect(restored.payload).toEqual(original.payload);
    expect(restored.category.value).toBe(original.category.value);
    expect(restored.severity.value).toBe(original.severity.value);
    expect(restored.source).toBe(original.source);
  });

  it("toPrimitivesでoccurredOnがISO文字列になる", () => {
    const primitives = original.toPrimitives();
    expect(typeof primitives.occurredOn).toBe("string");
    expect(primitives.occurredOn).toBe("2026-01-01T00:00:00.000Z");
  });

  it("toPrimitivesでcategoryがstring値になる", () => {
    const primitives = original.toPrimitives();
    expect(primitives.category).toBe("APPLICATION");
  });

  it("fromPrimitivesでcategoryがMonitoringEventCategoryインスタンスになる", () => {
    const restored = MonitoringEvent.fromPrimitives(original.toPrimitives());
    expect(restored.category).toBeInstanceOf(MonitoringEventCategory);
  });
});

describe("MonitoringEvent dedupKey", () => {
  const build = (overrides: Partial<{ eventName: string; source: string; discriminator?: string }>) =>
    new MonitoringEvent({
      eventId: Uuid.random().value,
      eventName: overrides.eventName ?? "ec.inventory.reservation_failed",
      aggregateId: "product-001",
      occurredOn: new Date("2026-01-01T00:00:00Z"),
      payload: {},
      category: MonitoringEventCategory.application(),
      severity: AlertSeverity.warning(),
      source: overrides.source ?? "inventory",
      discriminator: overrides.discriminator,
    });

  it("discriminator 無しは source::category::eventName", () => {
    expect(build({}).dedupKey()).toBe("inventory::APPLICATION::ec.inventory.reservation_failed");
  });

  it("discriminator が異なれば dedupKey も異なる（在庫不足と競合を畳み込まない）", () => {
    const insufficient = build({ discriminator: "INSUFFICIENT_STOCK" });
    const conflict = build({ discriminator: "CONCURRENT_CONFLICT" });
    expect(insufficient.dedupKey()).not.toBe(conflict.dedupKey());
    expect(conflict.dedupKey()).toBe(
      "inventory::APPLICATION::ec.inventory.reservation_failed::CONCURRENT_CONFLICT",
    );
  });

  it("discriminator はラウンドトリップで保持される", () => {
    const restored = MonitoringEvent.fromPrimitives(
      build({ discriminator: "INSUFFICIENT_STOCK" }).toPrimitives(),
    );
    expect(restored.discriminator).toBe("INSUFFICIENT_STOCK");
    expect(restored.dedupKey()).toBe(
      "inventory::APPLICATION::ec.inventory.reservation_failed::INSUFFICIENT_STOCK",
    );
  });
});

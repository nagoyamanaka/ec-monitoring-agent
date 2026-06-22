import { describe, it, expect } from "vitest";
import { KnownErrorPattern } from "./KnownErrorPattern.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";

const baseParams = {
  id: "a1b2c3d4-1234-4a5b-89ab-c1d2e3f4a5b6",
  name: "PAYMENT_TIMEOUT",
  description: "決済処理がタイムアウトしました。",
  eventNamePattern: "ec.payment.timeout",
  payloadConditions: [],
  severity: AlertSeverity.critical(),
  suggestedAction: "決済サービスのステータスを確認してください。",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("KnownErrorPattern.create()", () => {
  it("isPromotedがfalse、promotedAtがnullで作成される", () => {
    const pattern = KnownErrorPattern.create(baseParams);

    expect(pattern.isPromoted).toBe(false);
    expect(pattern.promotedAt).toBeNull();
    expect(pattern.name).toBe("PAYMENT_TIMEOUT");
    expect(pattern.eventNamePattern).toBe("ec.payment.timeout");
    expect(pattern.payloadConditions).toHaveLength(0);
    expect(pattern.severity.isCritical()).toBe(true);
  });

  it("payloadConditionsを持つパターンが作成できる", () => {
    const pattern = KnownErrorPattern.create({
      ...baseParams,
      id: "b2c3d4e5-2345-4b6c-9bcd-d2e3f4a5b6c7",
      name: "INVENTORY_INSUFFICIENT",
      eventNamePattern: "ec.inventory.reservation_failed",
      payloadConditions: [{ field: "reason", value: "INSUFFICIENT_STOCK" }],
      severity: AlertSeverity.warning(),
    });

    expect(pattern.payloadConditions).toHaveLength(1);
    expect(pattern.payloadConditions[0].field).toBe("reason");
    expect(pattern.payloadConditions[0].value).toBe("INSUFFICIENT_STOCK");
    expect(pattern.severity.isWarning()).toBe(true);
  });
});

describe("KnownErrorPattern.promote()", () => {
  it("isPromotedがtrue、promotedAtが設定された新しいインスタンスを返す", () => {
    const pattern = KnownErrorPattern.create(baseParams);
    const promoted = pattern.promote();

    expect(promoted.isPromoted).toBe(true);
    expect(promoted.promotedAt).not.toBeNull();
    expect(promoted.promotedAt).toBeInstanceOf(Date);
  });

  it("その他のプロパティは変わらない", () => {
    const pattern = KnownErrorPattern.create(baseParams);
    const promoted = pattern.promote();

    expect(promoted.id).toBe(pattern.id);
    expect(promoted.name).toBe(pattern.name);
    expect(promoted.eventNamePattern).toBe(pattern.eventNamePattern);
    expect(promoted.createdAt.toISOString()).toBe(pattern.createdAt.toISOString());
  });

  it("元のインスタンスは変更されない（イミュータブル）", () => {
    const pattern = KnownErrorPattern.create(baseParams);
    pattern.promote();

    expect(pattern.isPromoted).toBe(false);
    expect(pattern.promotedAt).toBeNull();
  });
});

describe("KnownErrorPattern toPrimitives/fromPrimitives", () => {
  it("payloadConditionsなしのパターンがラウンドトリップできる", () => {
    const original = KnownErrorPattern.create(baseParams);
    const restored = KnownErrorPattern.fromPrimitives(original.toPrimitives());

    expect(restored.id).toBe(original.id);
    expect(restored.name).toBe(original.name);
    expect(restored.description).toBe(original.description);
    expect(restored.eventNamePattern).toBe(original.eventNamePattern);
    expect(restored.payloadConditions).toHaveLength(0);
    expect(restored.severity.isCritical()).toBe(true);
    expect(restored.suggestedAction).toBe(original.suggestedAction);
    expect(restored.isPromoted).toBe(false);
    expect(restored.promotedAt).toBeNull();
    expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString());
  });

  it("payloadConditionsありのパターンがラウンドトリップできる", () => {
    const original = KnownErrorPattern.create({
      ...baseParams,
      id: "b2c3d4e5-2345-4b6c-9bcd-d2e3f4a5b6c7",
      payloadConditions: [{ field: "reason", value: "INSUFFICIENT_STOCK" }],
      severity: AlertSeverity.warning(),
    });

    const restored = KnownErrorPattern.fromPrimitives(original.toPrimitives());

    expect(restored.payloadConditions).toHaveLength(1);
    expect(restored.payloadConditions[0].field).toBe("reason");
    expect(restored.payloadConditions[0].value).toBe("INSUFFICIENT_STOCK");
    expect(restored.severity.isWarning()).toBe(true);
  });

  it("promote済みのパターンがラウンドトリップできる", () => {
    const original = KnownErrorPattern.create(baseParams).promote();
    const restored = KnownErrorPattern.fromPrimitives(original.toPrimitives());

    expect(restored.isPromoted).toBe(true);
    expect(restored.promotedAt).toBeInstanceOf(Date);
    expect(restored.promotedAt!.toISOString()).toBe(original.promotedAt!.toISOString());
  });
});

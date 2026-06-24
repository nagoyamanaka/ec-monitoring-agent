import { describe, it, expect } from "vitest";
import {
  AlertClassificationPrimitives,
  alertClassificationFromPrimitives,
  alertClassificationToPrimitives,
  ClassificationConfidence,
  InvalidClassificationConfidenceError,
} from "./AlertClassification.js";
import { AlertSeverity } from "../../Shared/domain/AlertSeverity.js";

describe("ClassificationConfidence", () => {
  describe("of()", () => {
    it("0〜1の値を受け付ける", () => {
      expect(ClassificationConfidence.of(0).value).toBe(0);
      expect(ClassificationConfidence.of(0.5).value).toBe(0.5);
      expect(ClassificationConfidence.of(1).value).toBe(1);
    });

    it("0未満でInvalidClassificationConfidenceErrorをthrowする", () => {
      expect(() => ClassificationConfidence.of(-0.1)).toThrow(
        InvalidClassificationConfidenceError,
      );
    });

    it("1超でInvalidClassificationConfidenceErrorをthrowする", () => {
      expect(() => ClassificationConfidence.of(1.1)).toThrow(
        InvalidClassificationConfidenceError,
      );
    });
  });

  describe("certain()", () => {
    it("1.0を返す", () => {
      expect(ClassificationConfidence.certain().value).toBe(1.0);
    });
  });

  describe("isHighConfidence()", () => {
    it("デフォルト閾値0.8以上でtrueを返す", () => {
      expect(ClassificationConfidence.of(0.8).isHighConfidence()).toBe(true);
      expect(ClassificationConfidence.of(0.9).isHighConfidence()).toBe(true);
    });

    it("0.8未満でfalseを返す", () => {
      expect(ClassificationConfidence.of(0.79).isHighConfidence()).toBe(false);
    });

    it("カスタム閾値を使える", () => {
      expect(ClassificationConfidence.of(0.5).isHighConfidence(0.5)).toBe(true);
      expect(ClassificationConfidence.of(0.49).isHighConfidence(0.5)).toBe(false);
    });
  });
});

describe("alertClassificationToPrimitives / alertClassificationFromPrimitives", () => {
  it("knownのラウンドトリップで同じ値が復元される", () => {
    const original: AlertClassificationPrimitives = {
      type: "known",
      source: "EXACT_MATCH",
      patternId: "pattern-001",
      patternName: "PAYMENT_TIMEOUT",
      severity: "CRITICAL",
      confidence: 0.9,
      matchedConditions: [
        { field: "eventName", expectedValue: "ec.payment.timeout", actualValue: "ec.payment.timeout" },
      ],
      unmatchedConditions: [
        { field: "amount", expectedValue: 1000, actualValue: 5000 },
      ],
    };

    const domain = alertClassificationFromPrimitives(original);
    const restored = alertClassificationToPrimitives(domain);

    expect(restored).toEqual(original);
  });

  it("sourceAlertId（類似既知の back-link）もラウンドトリップで保持される", () => {
    const original: AlertClassificationPrimitives = {
      type: "known",
      source: "SIMILARITY",
      patternId: "similar:inc-1",
      patternName: "類似既知: ec.inventory.reservation_failed",
      severity: "WARNING",
      confidence: 0.87,
      matchedConditions: [],
      unmatchedConditions: [],
      sourceAlertId: "alert-past-1",
    };

    const restored = alertClassificationToPrimitives(
      alertClassificationFromPrimitives(original),
    );

    expect(restored).toEqual(original);
  });

  it("sourceAlertId 未設定なら primitives に現れない（exactOptional 互換）", () => {
    const original: AlertClassificationPrimitives = {
      type: "known",
      source: "EXACT_MATCH",
      patternId: "p-1",
      patternName: "X",
      severity: "WARNING",
      confidence: 1,
      matchedConditions: [],
      unmatchedConditions: [],
    };

    const restored = alertClassificationToPrimitives(
      alertClassificationFromPrimitives(original),
    );

    expect("sourceAlertId" in restored).toBe(false);
  });

  it("unknownのラウンドトリップで同じ値が復元される", () => {
    const original: AlertClassificationPrimitives = { type: "unknown", confidence: null };

    const domain = alertClassificationFromPrimitives(original);
    const restored = alertClassificationToPrimitives(domain);

    expect(restored).toEqual(original);
  });

  it("fromPrimitivesでseverityとconfidenceが値オブジェクトに変換される", () => {
    const primitives: AlertClassificationPrimitives = {
      type: "known",
      source: "SIMILARITY",
      patternId: "p-001",
      patternName: "TEST",
      severity: "WARNING",
      confidence: 0.75,
      matchedConditions: [],
      unmatchedConditions: [],
    };

    const result = alertClassificationFromPrimitives(primitives);

    expect(result.type).toBe("known");
    if (result.type === "known") {
      expect(result.severity).toBeInstanceOf(AlertSeverity);
      expect(result.severity.isWarning()).toBe(true);
      expect(result.confidence).toBeInstanceOf(ClassificationConfidence);
      expect(result.confidence.value).toBe(0.75);
    }
  });
});
